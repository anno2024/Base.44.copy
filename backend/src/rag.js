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

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "what",
  "when",
  "where",
  "which",
  "why",
  "how",
  "can",
  "you",
  "your",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "will",
  "shall",
  "would",
  "could",
  "into",
  "about",
  "over",
  "under",
  "than",
  "then",
  "also",
  "just",
  "more",
  "most",
  "very",
  "some",
  "many",
  "their",
  "them",
  "they",
  "our",
  "its",
]);

const NON_DISTINCTIVE_TOKENS = new Set([
  "agent",
  "agents",
  "intelligent",
  "chapter",
  "section",
  "figure",
  "table",
]);

function buildQueryProfile(text) {
  const normalizedQuestion = normalize(text);
  const orderedTokens = normalizedQuestion
    .split(" ")
    .filter((token) => token.length > 2);
  const tokens = Array.from(new Set(orderedTokens));
  const counts = orderedTokens.reduce((acc, token) => {
    acc[token] = (acc[token] || 0) + 1;
    return acc;
  }, {});
  const keyTokens = tokens.filter((token) =>
    token.length >= 4 &&
    !STOP_WORDS.has(token) &&
    !NON_DISTINCTIVE_TOKENS.has(token),
  );
  const requiredTokens = Object.entries(counts)
    .filter(
      ([token, count]) =>
        count >= 2 &&
        token.length >= 4 &&
        !STOP_WORDS.has(token) &&
        !NON_DISTINCTIVE_TOKENS.has(token),
    )
    .map(([token]) => token);
  const phraseTokens = orderedTokens.filter(
    (token) => !STOP_WORDS.has(token),
  );
  const phrases = [];
  for (let i = 0; i < phraseTokens.length - 1; i += 1) {
    const bigram = `${phraseTokens[i]} ${phraseTokens[i + 1]}`.trim();
    if (bigram.length >= 7) phrases.push(bigram);

    if (i < phraseTokens.length - 2) {
      const trigram = `${phraseTokens[i]} ${phraseTokens[i + 1]} ${phraseTokens[i + 2]}`.trim();
      if (trigram.length >= 11) phrases.push(trigram);
    }
  }
  const uniquePhrases = Array.from(new Set(phrases));

  return {
    tokens,
    keyTokens: keyTokens.length > 0 ? keyTokens : tokens,
    requiredTokens,
    phrases: uniquePhrases,
  };
}

function isLikelyIndexLikeChunk(text) {
  const value = String(text || "");
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return true;
  if (/(\.\s*){6,}/.test(compact)) return true;

  if (/\b\d{2,4}(,\s*\d{2,4}){3,}\b/.test(compact)) {
    return true;
  }

  const commaCount = (compact.match(/,/g) || []).length;
  const digitGroups = (compact.match(/\d+/g) || []).length;
  const wordCount = tokenize(compact).length;
  if (wordCount > 20 && digitGroups > 8 && commaCount > 6) {
    return true;
  }

  return false;
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

function scoreChunkLexical(chunk, queryProfile) {
  if (isLikelyIndexLikeChunk(chunk)) return 0;

  const normalizedChunk = normalize(chunk);
  const chunkTokens = new Set(tokenize(chunk));
  if (!chunkTokens.size || !queryProfile?.tokens?.length) return 0;

  let overlap = 0;
  for (const token of queryProfile.tokens) {
    if (chunkTokens.has(token)) overlap += 1;
  }

  let keyOverlap = 0;
  for (const token of queryProfile.keyTokens) {
    if (chunkTokens.has(token)) keyOverlap += 1;
  }
  const missingRequired = (queryProfile.requiredTokens || []).some(
    (token) => !chunkTokens.has(token),
  );
  if (missingRequired) return 0;

  // Require at least one key query token match to avoid generic page hits.
  const minKeyMatches = queryProfile.keyTokens.length >= 3 ? 2 : 1;
  if (keyOverlap < minKeyMatches) return 0;

  const phraseHits = (queryProfile.phrases || []).reduce(
    (acc, phrase) => (normalizedChunk.includes(phrase) ? acc + 1 : acc),
    0,
  );
  if (phraseHits <= 0 && keyOverlap < 3) return 0;

  return (keyOverlap * 2 + overlap * 0.5 + phraseHits * 2.5) /
    Math.sqrt(chunkTokens.size);
}

export function buildRagContextLexical({ question, sources, topK = 4 }) {
  const queryProfile = buildQueryProfile(question);
  const candidates = [];

  for (const source of sources) {
    const chunks = chunkSourceWithMetadata(source);
    for (const chunk of chunks) {
      const score = scoreChunkLexical(chunk.text, queryProfile);
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
