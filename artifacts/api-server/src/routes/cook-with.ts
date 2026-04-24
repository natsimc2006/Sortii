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

const SYSTEM_PROMPT = `You are Sortii's Fridge Rescue engine. The user has told you what's in their fridge and cupboard. Your job is to suggest dinner ideas they can make RIGHT NOW with what they have.

Oil, salt, and pepper are always available. Do not count these as missing ingredients.

Rules:
- Always return EXACTLY 2 to 3 dinner ideas. Never fewer. Never more.
- Each idea must be genuinely makeable from the listed ingredients — no missing proteins or bases.
- Steps: maximum 3 steps, each under 15 words.
- Hook: one punchy line. Practical tone. Never poetic or aspirational.
- Time: realistic cook time in minutes.
- Difficulty: one of "very easy", "easy", or "medium".
- Use as many of the listed ingredients as possible across the suggestions.
- Prioritise meals under 30 minutes.

Return ONLY a valid JSON array. No preamble, no explanation, no markdown.

Format:
[
  {
    "name": "Egg fried rice",
    "hook": "Your eggs and rice — classic no-shop dinner.",
    "steps": ["Cook rice or use leftover. Beat eggs.", "Fry eggs in hot oil, breaking up as they cook. Add rice.", "Stir-fry 3–4 mins. Season with soy sauce or salt."],
    "timeMinutes": 15,
    "difficulty": "very easy"
  }
]`;

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
      max_tokens: 1024,
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

    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) {
      logger.warn("cook-with: AI did not return a JSON array");
      res.json({ result: [] });
      return;
    }
    cleaned = cleaned.slice(start, end + 1);

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      res.json({ result: [] });
      return;
    }

    logger.info({ count: parsed.length }, "cook-with: AI rescue success");
    res.json({ result: parsed });
  } catch (err) {
    logger.error({ err }, "cook-with: AI rescue error");
    res.status(500).json({ error: "Failed to generate rescue ideas" });
  }
});

export default router;
