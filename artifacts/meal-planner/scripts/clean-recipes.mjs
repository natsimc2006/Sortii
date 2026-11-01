/**
 * clean-recipes.mjs
 * ─────────────────
 * Housekeeping pass over data/recipes_unified_au.json. Safe to re-run:
 * every step is idempotent, and the file is rewritten in its existing
 * format (2-space indent, no trailing newline) so diffs stay readable.
 *
 * What it does:
 *   1. Removes duplicate recipes (same name, case-insensitive). Keeps the
 *      entry with a locale tag and an image; logs anything removed.
 *   2. Tags recipes with no `locale` as ["AU"]. These were added after the
 *      UK localisation pass and have no UK ingredient names yet. AU users
 *      already see them (the AU path doesn't filter); UK users already
 *      don't. This makes that explicit without changing behaviour.
 *   3. Normalises tag values so filters behave consistently:
 *        difficulty  "medium"                → "moderate"
 *        proteinType "vegetarian" | "plant"  → "none"
 *        proteinType "veal"                  → "beef"
 *      These match the unions in constants/recipes.ts.
 *
 * Usage (from artifacts/meal-planner):
 *   node scripts/clean-recipes.mjs           # write changes
 *   node scripts/clean-recipes.mjs --check   # report only, exit 1 if changes needed
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, "..", "data", "recipes_unified_au.json");
const checkOnly = process.argv.includes("--check");

const DIFFICULTY_MAP = { medium: "moderate" };
const PROTEIN_MAP = { vegetarian: "none", plant: "none", veal: "beef" };

const raw = fs.readFileSync(FILE, "utf8");
const recipes = JSON.parse(raw);
const log = [];

// ── 1. Duplicates ────────────────────────────────────────────────────────────
const score = (r) =>
  (Array.isArray(r.locale) && r.locale.length ? 2 : 0) + (r.imageUrl ? 1 : 0);

const byName = new Map();
for (const r of recipes) {
  const key = r.name.trim().toLowerCase();
  const kept = byName.get(key);
  if (!kept) {
    byName.set(key, r);
  } else if (score(r) > score(kept)) {
    log.push(`duplicate: removed ${kept.id} "${kept.name}" (kept ${r.id})`);
    byName.set(key, r);
  } else {
    log.push(`duplicate: removed ${r.id} "${r.name}" (kept ${kept.id})`);
  }
}
const keptIds = new Set([...byName.values()].map((r) => r.id));
const cleaned = recipes.filter((r) => keptIds.has(r.id));

// ── 2 & 3. Locale tags and tag normalisation ────────────────────────────────
let localeTagged = 0;
for (const r of cleaned) {
  if (!Array.isArray(r.locale) || r.locale.length === 0) {
    r.locale = ["AU"];
    localeTagged++;
  }
  if (DIFFICULTY_MAP[r.difficulty]) {
    log.push(`difficulty: ${r.id} ${r.difficulty} → ${DIFFICULTY_MAP[r.difficulty]}`);
    r.difficulty = DIFFICULTY_MAP[r.difficulty];
  }
  if (PROTEIN_MAP[r.proteinType]) {
    log.push(`proteinType: ${r.id} ${r.proteinType} → ${PROTEIN_MAP[r.proteinType]}`);
    r.proteinType = PROTEIN_MAP[r.proteinType];
  }
}
if (localeTagged) log.push(`locale: tagged ${localeTagged} untagged recipes as ["AU"]`);

const out = JSON.stringify(cleaned, null, 2);
const changed = out !== raw;

console.log(log.length ? log.join("\n") : "Nothing to clean.");
console.log(`\n${recipes.length} → ${cleaned.length} recipes`);

if (checkOnly) {
  process.exit(changed ? 1 : 0);
} else if (changed) {
  fs.writeFileSync(FILE, out);
  console.log(`Wrote ${path.relative(process.cwd(), FILE)}`);
}
