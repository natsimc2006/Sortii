#!/usr/bin/env node
/**
 * export-for-pricing.js
 *
 * Reads all recipes from the app's recipe data and exports a stripped-down
 * version containing only the fields needed for an external AI pricing pass.
 *
 * Output: scripts/recipes-for-pricing.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUT  = resolve(__dirname, "../artifacts/meal-planner/data/recipes.json");
const OUTPUT = resolve(__dirname, "recipes-for-pricing.json");

// ─── Load ──────────────────────────────────────────────────────────────────
const allRecipes = JSON.parse(readFileSync(INPUT, "utf8"));

// ─── Extract required fields only ──────────────────────────────────────────
const exported = allRecipes.map((r) => ({
  id:                r.id,
  name:              r.name,
  servings:          r.baseServings,
  estimatedCostBand: r.estimatedCostBand,
  ingredients:       (r.ingredients || []).map((ing) => ({
    name:     ing.name,
    quantity: ing.quantity,
    unit:     ing.unit ?? null,
  })),
}));

// ─── Write output ──────────────────────────────────────────────────────────
writeFileSync(OUTPUT, JSON.stringify(exported, null, 2), "utf8");

// ─── Summary ───────────────────────────────────────────────────────────────
const bands = { low: 0, medium: 0, high: 0, unknown: 0 };
for (const r of exported) {
  const b = r.estimatedCostBand;
  if (b === "low" || b === "medium" || b === "high") bands[b]++;
  else bands.unknown++;
}

console.log("─────────────────────────────────────────");
console.log(`  Recipes exported : ${exported.length}`);
console.log(`  Output file      : ${relative(process.cwd(), OUTPUT)}`);
console.log("─────────────────────────────────────────");
console.log("  Current cost band breakdown:");
console.log(`    low    : ${bands.low}`);
console.log(`    medium : ${bands.medium}`);
console.log(`    high   : ${bands.high}`);
if (bands.unknown) console.log(`    unknown: ${bands.unknown}`);
console.log("─────────────────────────────────────────");
console.log("  Done. Ready for AI pricing pass.");
