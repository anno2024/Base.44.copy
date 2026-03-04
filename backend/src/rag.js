function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const embeddingCache = new Map();

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((token) => token.length > 2);
}

function chunkText(text, maxChunkLength = 900) {
  if (!text) return [];
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkLength) {
      chunks.push(paragraph);
      continue;
    }

    for (let index = 0; index < paragraph.length; index += maxChunkLength) {
      chunks.push(paragraph.slice(index, index + maxChunkLength));
    }
  }

  return chunks;
}

function scoreChunk(chunk, queryTokens) {
  const chunkTokens = new Set(tokenize(chunk));
  if (!chunkTokens.size || !queryTokens.length) return 0;

  let overlap = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) overlap += 1;
  }

  return overlap / Math.sqrt(chunkTokens.size);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbeddings({ texts, embedMany, embedModel }) {
  const values = [];
  const missingTexts = [];
  const missingIndexes = [];

  texts.forEach((text, index) => {
    const key = `${embedModel}::${text}`;
    if (embeddingCache.has(key)) {
      values[index] = embeddingCache.get(key);
    } else {
      missingTexts.push(text);
      missingIndexes.push(index);
    }
  });

  if (missingTexts.length) {
    const generated = await embedMany(missingTexts);
    missingIndexes.forEach((index, localIndex) => {
      const embedding = generated[localIndex] || null;
      values[index] = embedding;
      if (embedding) {
        const key = `${embedModel}::${texts[index]}`;
        embeddingCache.set(key, embedding);
      }
    });
  }

  return values;
}

export async function buildRagContext({
  question,
  sources,
  topK = 4,
  retrievalMode = "hybrid",
  embedMany = null,
  embedModel = process.env.OLLAMA_EMBED_MODEL || "bge-m3",
}) {
  const queryTokens = tokenize(question);
  const chunks = [];

  for (const source of sources) {
    const sourceChunks = chunkText(source.content_text || "");
    for (const chunk of sourceChunks) {
      chunks.push({
        text: chunk,
        sourceName: source.name || source.url || "Unknown source",
        lexicalScore: scoreChunk(chunk, queryTokens),
      });
    }
  }

  const shouldUseEmbeddings =
    ["embedding", "hybrid"].includes(retrievalMode) && typeof embedMany === "function";

  let queryEmbedding = null;
  let chunkEmbeddings = [];

  if (shouldUseEmbeddings && chunks.length) {
    try {
      const texts = [question, ...chunks.map((item) => item.text)];
      const embeddings = await getEmbeddings({
        texts,
        embedMany,
        embedModel,
      });
      queryEmbedding = embeddings[0] || null;
      chunkEmbeddings = embeddings.slice(1);
    } catch {
      queryEmbedding = null;
      chunkEmbeddings = [];
    }
  }

  const candidates = chunks.map((chunk, index) => {
    const embeddingScore =
      queryEmbedding && chunkEmbeddings[index]
        ? cosineSimilarity(queryEmbedding, chunkEmbeddings[index])
        : 0;

    let score = chunk.lexicalScore;
    if (retrievalMode === "embedding") {
      score = embeddingScore;
    } else if (retrievalMode === "hybrid") {
      score = 0.65 * embeddingScore + 0.35 * chunk.lexicalScore;
    }

    return {
      score,
      lexicalScore: chunk.lexicalScore,
      text: chunk.text,
      sourceName: chunk.sourceName,
    };
  });

  let selected = candidates
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (!selected.length && retrievalMode !== "lexical") {
    selected = candidates
      .filter((item) => item.lexicalScore > 0)
      .sort((a, b) => b.lexicalScore - a.lexicalScore)
      .slice(0, topK)
      .map((item) => ({
        score: item.lexicalScore,
        text: item.text,
        sourceName: item.sourceName,
      }));
  }

  return {
    snippets: selected,
    contextText: selected
      .map(
        (item, index) =>
          `[Kilde ${index + 1}: ${item.sourceName}]\n${item.text}`,
      )
      .join("\n\n"),
  };
}
