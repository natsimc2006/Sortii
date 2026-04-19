import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";

const router = Router();

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "sk-placeholder";

const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

const SYSTEM_PROMPT = `You are a calm, practical family logistics assistant for Australian and UK households.
You receive a list of family members, events, and carpool contacts for the week.
Your job is to work out who goes where, flag any timing conflicts or impossible situations, and produce a clean plan.

Tone: warm, observational, lightly wry — never urgent, no gamification, no emoji.
Voice examples: "Jamie has back-to-back events Saturday — tight but doable."
"Two things at once for Mia on Sunday. Worth sorting before the weekend."

You must respond with ONLY valid JSON in this exact structure (no markdown, no explanation outside JSON):
{
  "status": "sorted" | "tight" | "needs_attention",
  "summary": "One sentence summary of the week, warm and specific",
  "smart_note": "One sentence of the most useful observation, or null if nothing to add",
  "plan": [
    {
      "adult": "Name",
      "day": "Monday",
      "duty": "Concise description of what this adult is covering"
    }
  ],
  "conflicts": [
    {
      "type": "overlap" | "impossible" | "tight",
      "description": "Plain-English description of the conflict"
    }
  ],
  "adult_lists": {
    "AdultName": "Their personalised list of duties as a plain text string, one line per item"
  },
  "unassigned_events": ["List any events with no adult assigned"]
}

Rules:
- Keep all text concise and plain
- "sorted" = no real problems, "tight" = some tight timing but workable, "needs_attention" = genuine conflicts
- adult_lists should be formatted like a text message the adult would actually want to receive
- If there are no conflicts, set "conflicts" to an empty array
- If smart_note is not needed, set it to null`;

router.post("/juggle", async (req, res) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    logger.info("juggle solve: calling Anthropic");

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0];
    if (!raw || raw.type !== "text") {
      res.status(500).json({ error: "Unexpected response format from AI" });
      return;
    }

    let parsed: unknown;
    try {
      // Strip optional markdown code fences (```json ... ```)
      const text = raw.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(text);
    } catch {
      logger.error({ text: raw.text }, "juggle: failed to parse AI JSON");
      res.status(500).json({ error: "AI returned invalid JSON", raw: raw.text });
      return;
    }

    logger.info("juggle solve: success");
    res.json({ result: parsed });
  } catch (err) {
    logger.error({ err }, "juggle solve: error");
    res.status(500).json({ error: "Failed to solve juggle" });
  }
});

export default router;
