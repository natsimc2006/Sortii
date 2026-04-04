#!/usr/bin/env node
/**
 * import-pricing.js
 *
 * Merges AI-generated costPerServeAUD values into recipes.json and
 * re-tags estimatedCostBand based on real prices.
 *
 * Thresholds:
 *   < 5.50  → 'low'
 *   5.50-9.00 → 'medium'
 *   > 9.00  → 'high'
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRICING = resolve(__dirname, "recipes-pricing-output.json");
const RECIPES = resolve(__dirname, "../artifacts/meal-planner/data/recipes.json");

// ─── Load ──────────────────────────────────────────────────────────────────
const pricing = JSON.parse(readFileSync(PRICING, "utf8"));
const recipes = JSON.parse(readFileSync(RECIPES, "utf8"));

// Build fast lookup: id → costPerServeAUD
const priceMap = new Map(pricing.map((p) => [p.id, p.costPerServeAUD]));

// ─── Re-tag helper ─────────────────────────────────────────────────────────
function bandFromCost(cost) {
  if (cost < 5.50) return "low";
  if (cost <= 9.00) return "medium";
  return "high";
}

// ─── Merge ─────────────────────────────────────────────────────────────────
const bands = { low: 0, medium: 0, high: 0, unchanged: 0 };
let updated = 0;

const merged = recipes.map((r) => {
  const cost = priceMap.get(r.id);
  if (cost == null) {
    bands.unchanged++;
    return r;
  }
  const newBand = bandFromCost(cost);
  bands[newBand]++;
  updated++;
  return { ...r, costPerServeAUD: cost, estimatedCostBand: newBand };
});

// ─── Write ─────────────────────────────────────────────────────────────────
writeFileSync(RECIPES, JSON.stringify(merged, null, 2), "utf8");

// ─── Summary ───────────────────────────────────────────────────────────────
console.log("─────────────────────────────────────────");
console.log(`  Recipes updated     : ${updated} / ${recipes.length}`);
console.log(`  Unchanged (no match): ${bands.unchanged}`);
console.log("  New band distribution:");
console.log(`    low    : ${bands.low}`);
console.log(`    medium : ${bands.medium}`);
console.log(`    high   : ${bands.high}`);
console.log("─────────────────────────────────────────");

// ─── Example calculation ───────────────────────────────────────────────────
// 5 meals, 2 people, first 5 recipes alphabetically
const householdSize = 2;
const first5 = [...merged]
  .filter((r) => r.costPerServeAUD != null)
  .sort((a, b) => a.name.localeCompare(b.name))
  .slice(0, 5);

const totalCost = first5.reduce((sum, r) => {
  return sum + r.costPerServeAUD * householdSize;
}, 0);
const rangeLow  = Math.round(totalCost * 0.92);
const rangeHigh = Math.round(totalCost * 1.08);

console.log("  Example: 5 meals, 2 people (first 5 recipes A→Z):");
first5.forEach((r) =>
  console.log(`    ${r.name.padEnd(36)} $${r.costPerServeAUD.toFixed(2)}/serve`)
);
console.log(`  Weekly range → $${rangeLow}–$${rangeHigh}`);
console.log("─────────────────────────────────────────");
console.log("  recipes.json updated. Ready to wire into the UI.");
