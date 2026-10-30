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
