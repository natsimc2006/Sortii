import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";

const router = Router();

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey =
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??
  process.env.ANTHROPIC_API_KEY ??
  "sk-placeholder";

const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

const SYSTEM_PROMPT = `You are Sortii, a calm and practical household meal planner.
Your job: suggest ONE realistic improvised dinner from the ingredients listed.

RULES:
- Use only the provided ingredients plus assumed basics (salt, pepper, oil, water, garlic if present).
- Do NOT introduce many new ingredients. Keep it real and achievable.
- Keep it simple, low-effort, and edible. No fancy chef language.
- Aim for the cheapest, least-fuss approach with what they have.
- Sound like a helpful friend, not a recipe blog.

Tone: warm, practical, lightly dry. Never shaming ("not glamorous, but still dinner").

Return ONLY valid JSON. No markdown fences. Exact shape:
{
  "title": "Meal name (short, plain English)",
  "reason": "1 sentence why this works — mention 1-2 key ingredients they have",
  "steps": ["step 1 (short)", "step 2 (short)", "step 3 (short)"],
  "cookTime": "e.g. 15 mins or 20-25 mins",
  "effort": "very easy | easy | moderate"
}`;

router.post("/cook-with", async (req, res) => {
  try {
    const { ingredients, preferences } = req.body as {
      ingredients?: string[];
      preferences?: string[];
    };

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      res.status(400).json({ error: "ingredients array required" });
      return;
    }

    const prefText =
      preferences && preferences.length > 0
        ? ` Tonight's vibe: ${preferences.join(", ")}.`
        : "";

    const prompt = `I have: ${ingredients.join(", ")}.${prefText} What can I make for dinner?`;

    logger.info({ ingredients: ingredients.length }, "cook-with: calling AI");

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0];
    if (!raw || raw.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format" });
      return;
    }

    let cleaned = raw.text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

    const parsed = JSON.parse(cleaned);
    logger.info("cook-with: AI fallback success");
    res.json({ result: parsed });
  } catch (err) {
    logger.error({ err }, "cook-with: AI fallback error");
    res.status(500).json({ error: "Failed to generate fallback meal" });
  }
});

export default router;
