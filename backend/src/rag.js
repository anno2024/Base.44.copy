import { createHash, randomUUID } from "node:crypto";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((token) => token.length > 2);
}

function hashText(text) {
  return createHash("sha256").update(String(text || "")).digest("hex");
}

export function hydrateCourseSources({ course, uploads = [] }) {
  const sources = Array.isArray(course?.content_sources)
    ? course.content_sources
    : [];

  return sources.map((source, index) => {
    const upload = uploads.find((item) => item.file_url === source.url);
    const contentText = String(source.content_text || upload?.content_text || "");
    const pageChunks = Array.isArray(source.content_pages)
      ? source.content_pages
      : Array.isArray(upload?.content_pages)
        ? upload.content_pages
        : [];
    const normalizedPageChunks = pageChunks.map((page) => ({
      page_number: Number.isFinite(Number(page?.page_number))
        ? Math.trunc(Number(page.page_number))
        : null,
      text: String(page?.text || ""),
    }));
    const hashInput =
      normalizedPageChunks.length > 0
        ? `${contentText}\n${JSON.stringify(normalizedPageChunks)}`
        : contentText;

    return {
      source_id: source.id || `${course?.id || "course"}-source-${index}`,
      name: source.name || source.url || `Source ${index + 1}`,
      url: source.url || "",
      type: source.type || "text",
      content_text: contentText,
      content_pages: pageChunks,
      content_hash: hashText(hashInput),
    };
  });
}

export function buildCourseSourcesSignature(sources) {
  const summary = (sources || [])
    .map((source) => ({
      id: source.source_id,
      name: source.name,
      url: source.url,
      hash: source.content_hash,
    }))
    .sort((a, b) => `${a.id}`.localeCompare(`${b.id}`));

  return hashText(JSON.stringify(summary));
}

function chunkText(text, maxChunkLength = 900, overlap = 140) {
  const value = String(text || "").trim();
  if (!value) return [];

  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkLength) {
      chunks.push(paragraph);
      continue;
    }

    let start = 0;
    while (start < paragraph.length) {
      const end = Math.min(start + maxChunkLength, paragraph.length);
      chunks.push(paragraph.slice(start, end));
      if (end >= paragraph.length) break;
      start = Math.max(0, end - overlap);
    }
  }

  return chunks;
}

function chunkSourceWithMetadata(source, maxChunkLength = 900, overlap = 140) {
  const pageBlocks = Array.isArray(source?.content_pages)
    ? source.content_pages
    : [];

  if (pageBlocks.length > 0) {
    const chunks = [];
    for (const pageBlock of pageBlocks) {
      const pageNumber = Number(pageBlock?.page_number);
      const pageText = String(pageBlock?.text || "").trim();
      if (!pageText) continue;

      const pageChunks = chunkText(pageText, maxChunkLength, overlap);
      for (const text of pageChunks) {
        chunks.push({
          text,
          pageNumber: Number.isFinite(pageNumber) && pageNumber > 0
            ? Math.trunc(pageNumber)
            : null,
        });
      }
    }
    if (chunks.length > 0) {
      return chunks;
    }
  }

  return chunkText(source?.content_text || "", maxChunkLength, overlap).map(
    (text) => ({
      text,
      pageNumber: null,
    }),
  );
}

function formatSnippetLabel(item) {
  if (Number.isInteger(item?.pageNumber) && item.pageNumber > 0) {
    return `${item.sourceName}, page ${item.pageNumber}`;
  }
  return item.sourceName;
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let normLeft = 0;
  let normRight = 0;

  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    normLeft += left[i] * left[i];
    normRight += right[i] * right[i];
  }

  if (!normLeft || !normRight) return 0;
  return dot / (Math.sqrt(normLeft) * Math.sqrt(normRight));
}

export async function buildCourseEmbeddingChunks({
  courseId,
  sources,
  sourceSignature,
  embedText,
  embeddingModel,
  maxChunkLength = 900,
  chunkOverlap = 140,
}) {
  const chunks = [];

  for (const source of sources) {
    if (!source.content_text?.trim()) continue;

    const split = chunkSourceWithMetadata(source, maxChunkLength, chunkOverlap);
    for (let chunkIndex = 0; chunkIndex < split.length; chunkIndex += 1) {
      const text = split[chunkIndex].text;
      const pageNumber = split[chunkIndex].pageNumber;
      const embedding = await embedText(text);

      chunks.push({
        id: randomUUID(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        course_id: courseId,
        source_signature: sourceSignature,
        embedding_model: embeddingModel,
        source_id: source.source_id,
        source_name: source.name,
        source_url: source.url,
        chunk_index: chunkIndex,
        page_number: pageNumber,
        text,
        embedding,
      });
    }
  }

  return chunks;
}

function scoreChunkLexical(chunk, queryTokens) {
  const chunkTokens = new Set(tokenize(chunk));
  if (!chunkTokens.size || !queryTokens.length) return 0;

  let overlap = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) overlap += 1;
  }

  return overlap / Math.sqrt(chunkTokens.size);
}

export function buildRagContextLexical({ question, sources, topK = 4 }) {
  const queryTokens = tokenize(question);
  const candidates = [];

  for (const source of sources) {
    const chunks = chunkSourceWithMetadata(source);
    for (const chunk of chunks) {
      const score = scoreChunkLexical(chunk.text, queryTokens);
      if (score <= 0) continue;

      candidates.push({
        score,
        text: chunk.text,
        sourceName: source.name || source.url || "Unknown source",
        pageNumber: chunk.pageNumber,
      });
    }
  }

  const selected = candidates.sort((a, b) => b.score - a.score).slice(0, topK);

  return {
    snippets: selected,
    contextText: selected
      .map(
        (item, index) =>
          `[Kilde ${index + 1}: ${formatSnippetLabel(item)}]\n${item.text}`,
      )
      .join("\n\n"),
  };
}

export async function buildRagContextFromEmbeddings({
  question,
  chunks,
  embedText,
  topK = 4,
}) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { snippets: [], contextText: "" };
  }

  const queryEmbedding = await embedText(question);
  const ranked = chunks
    .map((chunk) => ({
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
      text: chunk.text,
      sourceName: chunk.source_name || chunk.source_url || "Unknown source",
      pageNumber: Number.isInteger(chunk.page_number)
        ? chunk.page_number
        : null,
    }))
    .filter((chunk) => Number.isFinite(chunk.score) && chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    snippets: ranked,
    contextText: ranked
      .map(
        (item, index) =>
          `[Kilde ${index + 1}: ${formatSnippetLabel(item)}]\n${item.text}`,
      )
      .join("\n\n"),
  };
}
