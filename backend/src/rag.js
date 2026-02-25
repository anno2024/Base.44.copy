function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(' ')
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

export function buildRagContext({ question, sources, topK = 4 }) {
  const queryTokens = tokenize(question);
  const candidates = [];

  for (const source of sources) {
    const chunks = chunkText(source.content_text || '');
    for (const chunk of chunks) {
      const score = scoreChunk(chunk, queryTokens);
      if (score > 0) {
        candidates.push({
          score,
          text: chunk,
          sourceName: source.name || source.url || 'Unknown source'
        });
      }
    }
  }

  const selected = candidates.sort((a, b) => b.score - a.score).slice(0, topK);

  return {
    snippets: selected,
    contextText: selected
      .map((item, index) => `[Kilde ${index + 1}: ${item.sourceName}]\n${item.text}`)
      .join('\n\n')
  };
}
