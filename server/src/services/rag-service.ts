import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import type { CourseSource, UploadedFile } from '@prisma/client';

const VECTOR_SIZE = 256;
const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 120;

export interface SourceInput {
  name?: string;
  type?: string;
  url?: string;
  content_text?: string;
}

const sanitizeText = (text?: string | null) => text?.replace(/\s+/g, ' ').trim() ?? '';

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const hashToken = (token: string) => {
  const hash = crypto.createHash('sha256').update(token).digest();
  return hash.readUInt32BE(0);
};

const embedVector = (text: string): number[] => {
  const tokens = tokenize(text);
  const vector = new Array<number>(VECTOR_SIZE).fill(0);
  for (const token of tokens) {
    const index = hashToken(token) % VECTOR_SIZE;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0)) || 1;
  return vector.map((val) => Number((val / norm).toFixed(6)));
};

const chunkText = (text: string) => {
  const clean = sanitizeText(text);
  if (!clean) {
    return [];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + CHUNK_SIZE);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) {
      break;
    }
    start = end - CHUNK_OVERLAP;
    if (start < 0) {
      start = 0;
    }
  }
  return chunks;
};

const parseVector = (value: string): number[] => {
  try {
    const parsed = JSON.parse(value) as number[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
};

const cosineSimilarity = (a: number[], b: number[]) => {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB) || 1;
  return dot / denom;
};

const extractUploadId = (url?: string | null) => {
  if (!url) return null;
  const byFiles = url.match(/\/files\/([a-zA-Z0-9-]+)/);
  if (byFiles?.[1]) {
    return byFiles[1];
  }
  const byCustom = url.match(/upload:([a-zA-Z0-9-]+)/);
  return byCustom?.[1] ?? null;
};

const toSourcePayloads = (sources?: SourceInput[] | null) => {
  if (!Array.isArray(sources)) {
    return [];
  }
  return sources.filter((source) => source && typeof source === 'object');
};

export class RagService {
  async ensureUploadEmbeddings(upload: UploadedFile) {
    if (upload.extracted_text) {
      const chunks = chunkText(upload.extracted_text);
      const chunkPayloads = chunks.map((chunk, index) => ({
        upload_id: upload.id,
        chunk_index: index,
        content: chunk,
        embedding: JSON.stringify(embedVector(chunk))
      }));
      if (chunkPayloads.length > 0) {
        await prisma.uploadedFileChunk.deleteMany({ where: { upload_id: upload.id } });
        await prisma.uploadedFileChunk.createMany({ data: chunkPayloads });
      }
    }
  }

  async syncCourseSources(courseId: string, sources?: SourceInput[] | null): Promise<void> {
    const parsedSources = toSourcePayloads(sources);
    await prisma.courseMaterialChunk.deleteMany({ where: { course_id: courseId } });
    await prisma.courseSource.deleteMany({ where: { course_id: courseId } });

    for (const source of parsedSources) {
      const uploadId = extractUploadId(source.url);
      const upload = uploadId
        ? await prisma.uploadedFile.findUnique({
            where: { id: uploadId },
            include: { chunks: true }
          })
        : null;

      const text = source.content_text || upload?.extracted_text || upload?.preview_text || '';
      const createdSource = await prisma.courseSource.create({
        data: {
          course_id: courseId,
          upload_id: upload?.id ?? null,
          title: source.name ?? upload?.original_name ?? 'Kursmateriale',
          type: source.type ?? (upload?.mime_type?.includes('pdf') ? 'pdf' : 'document'),
          url: source.url,
          content_text: text.slice(0, 10_000)
        }
      });

      if (upload?.chunks?.length) {
        await this.copyUploadChunksToCourse(upload, createdSource);
      } else if (text) {
        await this.createCourseChunks(createdSource, text);
      }
    }
  }

  private async copyUploadChunksToCourse(upload: UploadedFile & { chunks: { id: string; chunk_index: number; content: string; embedding: string }[] }, source: CourseSource) {
    if (!upload.chunks.length) return;
    const chunkPayloads = upload.chunks.map((chunk) => ({
      course_id: source.course_id,
      source_id: source.id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      embedding: chunk.embedding
    }));
    await prisma.courseMaterialChunk.createMany({ data: chunkPayloads });
  }

  private async createCourseChunks(source: CourseSource, text: string) {
    const chunks = chunkText(text);
    if (!chunks.length) return;
    const payloads = chunks.map((chunk, index) => ({
      course_id: source.course_id,
      source_id: source.id,
      chunk_index: index,
      content: chunk,
      embedding: JSON.stringify(embedVector(chunk))
    }));
    await prisma.courseMaterialChunk.createMany({ data: payloads });
  }

  async getContext(courseId: string | null, query: string, limit = 4) {
    if (!courseId) {
      return [];
    }
    const chunks = await prisma.courseMaterialChunk.findMany({
      where: { course_id: courseId },
      take: 200
    });
    if (!chunks.length) {
      return [];
    }
    const queryVector = embedVector(query);
    const ranked = chunks
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryVector, parseVector(chunk.embedding))
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return ranked.map(({ chunk, score }) => ({
      content: chunk.content,
      source_id: chunk.source_id,
      score
    }));
  }
}
