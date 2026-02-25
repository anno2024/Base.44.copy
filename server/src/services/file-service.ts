import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pdfParse from 'pdf-parse';
import type { Env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { RagService } from './rag-service.js';

export interface StoredFileResult {
  file_id: string;
  file_url: string;
  preview_text?: string | null;
}

export class FileService {
  private ragService: RagService;
  private storageRoot: string;
  private baseUrl: string;

  constructor(env: Env, ragService = new RagService()) {
    this.ragService = ragService;
    this.storageRoot = env.FILE_STORAGE_ROOT;
    this.baseUrl = env.BASE_URL;
  }

  async saveFile(file: Express.Multer.File): Promise<StoredFileResult> {
    const fileId = crypto.randomUUID();
    const folderPath = path.join(this.storageRoot, fileId);
    const storagePath = path.join(folderPath, file.originalname);

    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(storagePath, file.buffer);

    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const extractedText = await this.extractText(file);
    const preview = extractedText?.slice(0, 280) ?? null;

    const upload = await prisma.uploadedFile.create({
      data: {
        id: fileId,
        original_name: file.originalname,
        mime_type: file.mimetype,
        storage_path: storagePath,
        size_bytes: file.size,
        sha256,
        extracted_text: extractedText,
        preview_text: preview
      }
    });

    await this.ragService.ensureUploadEmbeddings(upload);

    const fileUrl = `${this.baseUrl.replace(/\/$/, '')}/files/${fileId}/${encodeURIComponent(file.originalname)}`;
    return { file_id: fileId, file_url: fileUrl, preview_text: preview };
  }

  private async extractText(file: Express.Multer.File): Promise<string | null> {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      try {
        const parsed = await pdfParse(file.buffer);
        return parsed.text;
      } catch (error) {
        console.warn('Failed to parse PDF', error);
        return null;
      }
    }
    if (file.mimetype.startsWith('text/') || file.originalname.endsWith('.md')) {
      return file.buffer.toString('utf8');
    }
    return null;
  }
}
