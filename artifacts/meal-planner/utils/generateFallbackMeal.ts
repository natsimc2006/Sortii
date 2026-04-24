import { Platform } from "react-native";
import { AiMealIdea } from "./cookWithTypes";

function apiBase(): string {
  return Platform.OS === "web" ? "" : "http://localhost:8080";
}

/**
 * Calls the API server to generate 2-3 rescue meal ideas using the Anthropic AI.
 * Returns an empty array if the server is unavailable, returns an error, or the
 * AI response could not be parsed.
 */
export async function generateFallbackMeal(
  ingredients: string[],
  preferences: string[],
): Promise<AiMealIdea[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${apiBase()}/api/cook-with`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients, preferences }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return null;
    const data = (await res.json()) as { result?: AiMealIdea[] };
    const result = data.result;
    if (!Array.isArray(result)) return null;
    return result;
  } catch {
    return null;
  }
}
