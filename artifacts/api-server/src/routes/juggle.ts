import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { logger } from "../lib/logger";

const router = Router();

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "sk-placeholder";

const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

const SYSTEM_PROMPT = `You are a family weekend logistics solver for Sortii. You receive a list of events and available adults/drivers.

YOUR JOB IS TO DECIDE — not to ask.
Never say you need more information.
Never say "awaiting clarification".
If information is missing, make the most sensible assumption and state it briefly.

IMPORTANT: Each event in the input has an "EventID" field. Use that exact EventID as the "event_id" value in your schedule items. This allows the app to map assignments back to specific events.

DECISION RULES:
1. Sort all events by time
2. Assign available adults to events:
   - Adults marked as drivers get transport events
   - If a child is named on an event, assume that child needs taking there
   - If no child is named, assume any available adult can cover it
   - Split events across adults to reduce load — do not assign everything to one adult if two are available
3. Detect conflicts:
   - Two events at the same time requiring the same adult = conflict
   - Flag it but still assign someone and state your assumption
4. When in doubt, make a call:
   - "Mum takes the 10am, Dad takes 11am" is always better than "we need to know who goes where"
   - State assumptions in plain English at the bottom of the smart_note field
5. Free windows:
   - Note any adult with 30+ min free
   - Frame as a positive, not just data

TONE: Warm, direct, decisive. Never corporate. Never alarming. Short sentences. Make the call. The parent is tired — give them an answer.

OUTPUT RULES (critical — violation causes a 500 error):
- Return ONLY valid JSON. Nothing before or after the JSON object.
- Do NOT wrap in markdown code fences (no \`\`\`json or \`\`\`).
- ALL string values must be wrapped in double quotes — including event titles, names, locations, and activity names that users typed. Even if an activity name looks odd, quote it.
- Numbers, booleans (true/false), and null are NOT quoted.
- Validate mentally: every "key": value pair must have its string value in double quotes.

{
  "weekend_summary": {
    "total_events": number,
    "conflicts_resolved": number,
    "tight_windows": number,
    "impossible_clashes": number
  },
  "events": [
    {
      "id": "string",
      "child": "string or null",
      "activity": "string",
      "location": "string or null",
      "day": "Saturday | Sunday | Weekday",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "assigned_adult": "string",
      "adult_must_stay": false,
      "child_colour_index": 0
    }
  ],
  "conflicts": [
    {
      "id": "string",
      "type": "overlap | unassigned | tight",
      "severity": "tight | warning | impossible",
      "description": "string — plain English, max 12 words, state what clashes",
      "involved_events": ["event_id"],
      "involved_adults": ["string"],
      "suggested_contacts": [],
      "recommendation": "string — what to do, action-first, decisive, max 15 words",
      "options": [
        "string — action first, max 10 words",
        "string — action first, max 10 words"
      ]
    }
  ],
  "adult_plans": [
    {
      "adult": "string",
      "can_drive": true,
      "schedule": [
        {
          "time": "HH:MM",
          "child": "string or null",
          "activity": "string",
          "location": "string or null",
          "event_id": "string"
        }
      ],
      "free_windows": [
        {
          "from": "HH:MM",
          "to": "HH:MM",
          "duration_minutes": number,
          "is_end_of_day": false
        }
      ]
    }
  ],
  "travel_estimates": [],
  "least_painful_version": {
    "applicable": false
  },
  "smart_note": "string or null — max 2 sentences. State any assumptions made. Note one useful observation. Return null if nothing to add."
}`;

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
      // Strip markdown fences if present
      let cleanText = raw.text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      // Find JSON boundaries
      const start = cleanText.indexOf("{");
      const end   = cleanText.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        cleanText = cleanText.slice(start, end + 1);
      }

      // Try standard parse first; fall back to jsonrepair for minor AI formatting mistakes
      try {
        parsed = JSON.parse(cleanText);
      } catch {
        logger.warn("juggle: standard JSON.parse failed, attempting jsonrepair");
        const repaired = jsonrepair(cleanText);
        parsed = JSON.parse(repaired);
        logger.info("juggle: jsonrepair succeeded");
      }
    } catch {
      logger.error({ text: raw.text }, "juggle: failed to parse AI JSON even after repair");
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
