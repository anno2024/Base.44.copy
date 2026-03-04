const DEFAULT_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 45000);

async function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

export async function invokeOllama({
  prompt,
  systemPrompt = "",
  responseFormat = "text",
}) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";

  const payload = {
    model,
    prompt,
    stream: false,
    system: systemPrompt || undefined,
    format: responseFormat === "json" ? "json" : undefined,
    options: {
      temperature: 0.2,
    },
  };

  try {
    const response = await withTimeout((signal) =>
      fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      }),
    );

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response?.trim() || "";
  } catch (error) {
    throw new Error(`Local LLM unavailable (${error.message})`);
  }
}

export async function embedWithOllama(text) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_EMBED_MODEL || "bge-m3";

  const payload = {
    model,
    prompt: String(text || ""),
  };

  try {
    const response = await withTimeout((signal) =>
      fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      }),
    );

    if (!response.ok) {
      throw new Error(`Ollama embedding error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data?.embedding)) {
      throw new Error("Missing embedding vector in response");
    }
    return data.embedding;
  } catch (error) {
    throw new Error(`Local embedding model unavailable (${error.message})`);
  }
}

export function fallbackAnswer({ hintOnly = false, question }) {
  if (hintOnly) {
    return `Jeg kan gi deg et hint i stedet for fasit: Finn nøkkelbegrepene i spørsmålet, koble dem til pensum, og forklar hvorfor hvert steg er riktig. Spørsmål: ${question}`;
  }
  return `Jeg klarte ikke å nå lokal LLM akkurat nå. Basert på spørsmålet ditt kan du starte med å definere sentrale begreper, anvende relevant teori fra kurset, og bygge svaret stegvis.`;
}
