import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { logger } from "../lib/logger";

const router = Router();

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "sk-placeholder";

const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

const SYSTEM_PROMPT = `You are a family weekend logistics solver for Sortii. Given events, adults, and context, produce a conflict-resolved weekend plan. Output must feel like a calm, smart friend — not a system report.

RULES
─────
1. Sort chronologically. Assign adults to events — must-happen before nice-to-have.
2. Estimate Australian suburban drive times. TIGHT = buffer < 15 min. IMPOSSIBLE = drive > gap. COMFORTABLE = 15+ min buffer.
3. must + must conflict: flag it, surface carpool contacts by name, keep both events.
4. must + nice conflict: recommend dropping the nice-to-have — state it clearly, not as a question.
5. nice + nice conflict: drop the one with fewer constraints. Note warmly.
6. Build least_painful_version only when nice-to-have events are in conflict.
7. Trust user's free-text notes above your own estimates.
8. Only suggest a carpool contact for the specific child they are listed as helping.
9. child_colour_index: assign 0,1,2,3… by order of first appearance across all events.
10. smart_note: max 2 sentences, most useful non-obvious observation, or null.
11. Medical appointments (doctor, GP, dentist, hospital, physio) are always must-priority. Never recommend rescheduling them.
12. When an adult finishes nearby and another adult has a conflict — name the handoff explicitly with estimated drive time.
13. When building adult assignments, treat child activities (football, netball, sport) as requiring one adult for drop-off AND one adult available for pick-up. These may be different adults if a handoff is feasible.
14. Example correct resolution: Mum drops Izzy at Netball (10:30, Wangi Wangi), proceeds to Doctors (11:00, Rathmines, 15 min drive — arrives just in time). Dad takes Tom to Football (10:00, Morisset, ends 11:00), drives to Wangi Wangi (~12 min) to collect Izzy at 11:30. This is a comfortable handoff — surface it as the solution, not a conflict.
15. IMPORTANT: Each event in the input has a "Type" field. One-off events may be rescheduled. Recurring (weekly) events must NEVER be suggested for rescheduling.
16. PRIORITY ORDER for conflicts: (1) Can another adult cover via handoff? Name them and the drive time. (2) Reschedule the one-off (not the recurring). (3) Flag as manual if both are unmoveable.
17. Personal appointments: if the "Child/person" field contains an adult name (e.g. "Mum", "Dad") and the event is a personal appointment (doctor, GP, dentist, hospital, physio, etc.), that adult MUST attend personally. Do NOT assign another adult to cover this event. The question is only whether another adult can free up this adult's other obligations so they can attend — not whether someone else can attend in their place.

TONE: Plain English. Warm, practical, never alarming. Free windows = breathing space, not system data. Make the call — the parent is tired.

OUTPUT RULES (critical — violation causes a 500 error):
- Return ONLY valid JSON. Nothing before or after the JSON object.
- Do NOT wrap in markdown code fences.
- ALL string values must be in double quotes.
- Numbers, booleans, and null are NOT quoted.

{
  "weekend_summary": {"total_events":number,"conflicts_resolved":number,"tight_windows":number,"impossible_clashes":number},
  "least_painful_version": {
    "applicable":true|false,"summary":"string or null",
    "plan":[{"time":"HH:MM","adult":"string","child":"string","activity":"string","location":"string","status":"kept|skipped|reassigned"}],
    "dropped_events":[{"child":"string","activity":"string","reason":"string"}]
  },
  "travel_estimates": [{
    "adult":"string","from_event_id":"string","to_event_id":"string",
    "from_location":"string","to_location":"string",
    "from_end_time":"HH:MM","to_start_time":"HH:MM",
    "available_gap_minutes":number,"estimated_drive_minutes":number,
    "estimated_drive_display":"string","buffer_minutes":number,
    "status":"comfortable|tight|impossible","note":"string or null"
  }],
  "events": [{
    "id":"string","child":"string or null","activity":"string","location":"string or null",
    "day":"Saturday|Sunday|Weekday","start_time":"HH:MM","end_time":"HH:MM",
    "assigned_adult":"string","adult_must_stay":false,"priority":"must|nice","child_colour_index":0
  }],
  "conflicts": [{
    "id":"string","type":"overlap|unassigned|tight|impossible",
    "severity":"tight|warning|impossible",
    "description":"string — plain English, max 12 words",
    "involved_events":["event_id"],"involved_adults":["string"],
    "suggested_contacts":["string"],
    "recommendation":"string — plain English, action-first, decisive, max 20 words",
    "options":["string — max 10 words","string — max 10 words"]
  }],
  "adult_plans": [{
    "adult":"string","can_drive":true,
    "schedule":[{"time":"HH:MM","child":"string or null","activity":"string","location":"string or null","event_id":"string","priority":"must|nice"}],
    "free_windows":[{"from":"HH:MM","to":"HH:MM","duration_minutes":number,"is_end_of_day":false}]
  }],
  "smart_note":"string or null"
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
