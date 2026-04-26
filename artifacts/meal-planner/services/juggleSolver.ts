import { Platform } from "react-native";

function apiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "http://localhost:8080";
}

const HANDOFF_KEYWORDS = [
  "collects", "picks up", "covers", "takes over", "heads to",
  "while mum", "while dad", "while mum", "while dad",
];

function normaliseConflicts(conflicts: Record<string, unknown>[]): Record<string, unknown>[] {
  return conflicts.map((conflict) => {
    const rec = ((conflict.recommendation as string) ?? "").toLowerCase();
    const isHandoff = HANDOFF_KEYWORDS.some((kw) => rec.includes(kw));
    if (isHandoff && conflict.severity !== "resolved") {
      return { ...conflict, type: "resolved", severity: "resolved" };
    }
    return conflict;
  });
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

    const raw = json.result;
    const normalisedResult: Record<string, unknown> = {
      ...raw,
      conflicts: normaliseConflicts((raw.conflicts as Record<string, unknown>[]) ?? []),
    };
    return normalisedResult;
  } finally {
    clearTimeout(timer);
  }
}

export { normaliseConflicts };
