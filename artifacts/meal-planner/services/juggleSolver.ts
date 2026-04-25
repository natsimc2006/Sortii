import { Platform } from "react-native";

function apiBase(): string {
  return Platform.OS === "web" ? "" : "http://localhost:8080";
}

export async function solveJuggle(userMessage: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${apiBase()}/api/juggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: userMessage }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Juggle API error ${res.status}: ${errBody}`);
    }

    const json = (await res.json()) as { result?: Record<string, unknown>; error?: string };
    if (json.error) throw new Error(json.error);
    if (!json.result) throw new Error("Empty result from juggle API");
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}
