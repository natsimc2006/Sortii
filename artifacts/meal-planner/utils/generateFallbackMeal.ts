import { Platform } from "react-native";
import { FallbackMealIdea } from "./cookWithTypes";

function apiBase(): string {
  return Platform.OS === "web" ? "" : "http://localhost:8080";
}

/**
 * Calls the API server to generate an improvised meal idea using the Anthropic AI.
 * Returns null if the server is unavailable or returns an error.
 */
export async function generateFallbackMeal(
  ingredients: string[],
  preferences: string[],
): Promise<FallbackMealIdea | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${apiBase()}/api/cook-with`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients, preferences }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return null;
    const data = (await res.json()) as { result?: FallbackMealIdea };
    return data.result ?? null;
  } catch {
    return null;
  }
}
