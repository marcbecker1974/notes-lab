import "server-only";

/** Model selection lives here; override OPENROUTER_MODEL in .env.local. */
export function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || apiKey === "your-openrouter-api-key") {
    throw new Error("OPENROUTER_API_KEY is missing in .env.local.");
  }
  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash",
  };
}

/**
 * Embedding rules (CLAUDE.md): one fixed model, never read from the environment. The
 * documents.embedding column is vector(1536); changing the model or the dimension means
 * dropping and re-embedding every document, otherwise retrieval breaks silently.
 */
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
