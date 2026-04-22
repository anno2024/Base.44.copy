import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const backendEnvPath = path.join(projectRoot, "backend", ".env");
const backendEnvExamplePath = path.join(projectRoot, "backend", ".env.example");

function parseEnvFile(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

async function loadBackendEnv() {
  for (const envPath of [backendEnvPath, backendEnvExamplePath]) {
    try {
      const content = await fs.readFile(envPath, "utf8");
      return parseEnvFile(content);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return {};
}

function isLocalOllamaHost(baseUrl) {
  try {
    const { hostname } = new URL(baseUrl);
    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function getOllamaTags(baseUrl) {
  return fetchJson(`${baseUrl}/api/tags`);
}

async function isOllamaReady(baseUrl) {
  try {
    await getOllamaTags(baseUrl);
    return true;
  } catch {
    return false;
  }
}

function startOllamaProcess() {
  return new Promise((resolve, reject) => {
    const child = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function waitForOllama(baseUrl, timeoutMs = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isOllamaReady(baseUrl)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

function collectMissingModels(tagsPayload, requiredModels) {
  const available = new Set(
    (tagsPayload?.models || [])
      .map((model) => model?.name)
      .filter(Boolean),
  );

  return [...new Set(requiredModels.filter((model) => model && !available.has(model)))];
}

function isTruthyEnvValue(value, fallback = true) {
  if (value == null || value === "") {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function runOllamaCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ollama", args, {
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ollama ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

export async function ensureOllamaReady() {
  const envValues = await loadBackendEnv();
  const baseUrl =
    process.env.OLLAMA_BASE_URL ||
    envValues.OLLAMA_BASE_URL ||
    "http://localhost:11434";
  const model =
    process.env.OLLAMA_MODEL || envValues.OLLAMA_MODEL || "qwen2.5:7b-instruct";
  const embedModel =
    process.env.OLLAMA_EMBED_MODEL ||
    envValues.OLLAMA_EMBED_MODEL ||
    "bge-m3";
  const autoPullModels = isTruthyEnvValue(
    process.env.OLLAMA_AUTO_PULL ?? envValues.OLLAMA_AUTO_PULL,
    true,
  );

  if (!isLocalOllamaHost(baseUrl)) {
    console.log(`Using remote Ollama at ${baseUrl}; skipping local startup.`);
    return;
  }

  if (!(await isOllamaReady(baseUrl))) {
    console.log(`Ollama is not running at ${baseUrl}. Starting local server...`);

    try {
      await startOllamaProcess();
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(
          "Could not find the `ollama` command. Install Ollama first, then retry.",
        );
      }
      throw error;
    }

    const ready = await waitForOllama(baseUrl);
    if (!ready) {
      throw new Error(
        `Started Ollama, but it did not become ready at ${baseUrl} within 20 seconds.`,
      );
    }

    console.log("Ollama is ready.");
  } else {
    console.log("Ollama is already running.");
  }

  try {
    const tags = await getOllamaTags(baseUrl);
    const missingModels = collectMissingModels(tags, [model, embedModel]);

    if (missingModels.length > 0) {
      if (!autoPullModels) {
        console.warn(
          `Missing Ollama model(s): ${missingModels.join(", ")}. Set OLLAMA_AUTO_PULL=true or run \`ollama pull <model>\` manually before using LLM features.`,
        );
        return;
      }

      console.log(`Pulling missing Ollama model(s): ${missingModels.join(", ")}`);

      for (const missingModel of missingModels) {
        console.log(`Running: ollama pull ${missingModel}`);
        await runOllamaCommand(["pull", missingModel]);
      }

      console.log("Required Ollama models are ready.");
    }
  } catch {
    // Health check already passed, so a failed tags fetch here should not block startup.
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  ensureOllamaReady().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
