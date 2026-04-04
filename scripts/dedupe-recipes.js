#!/usr/bin/env node
/**
 * dedupe-recipes.js
 *
 * Removes true duplicate recipes and renames near-duplicate variants
 * so every recipe has a clearly distinct name.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES = resolve(__dirname, "../artifacts/meal-planner/data/recipes.json");

const recipes = JSON.parse(readFileSync(RECIPES, "utf8"));

// ─── Renames ───────────────────────────────────────────────────────────────
const RENAMES = {
  r019: "Classic Pumpkin Soup",
  r064: "Coconut Ginger Pumpkin Soup",
  r046: "Quick Tuna Pasta Bake",
  r029: "Chicken Schnitzel with Potato Salad",
  r048: "Classic Chicken Schnitzel",
  r020: "Beef Soft Tacos",
  r075: "Crispy Beef Tacos",
};

// ─── Deletions ─────────────────────────────────────────────────────────────
// Keeping the better-described recipe in each true duplicate pair:
//   r097 → keep r012 (Chicken Caesar Salad — classic description)
//   r098 → keep r022 (Mushroom Risotto — more detailed description)
//   r070 → keep r031 (Chilli Con Carne — richer description)
//   r080 → keep r050 (Creamy Mushroom Pasta — more distinctive description)
//   r079 → keep r029 + r048 (Chicken Schnitzel — plainest version removed)
const DELETE_IDS = new Set(["r097", "r098", "r070", "r080", "r079"]);

// ─── Apply ─────────────────────────────────────────────────────────────────
let renamed = 0;
let deleted = 0;

const updated = recipes
  .filter((r) => {
    if (DELETE_IDS.has(r.id)) { deleted++; return false; }
    return true;
  })
  .map((r) => {
    if (RENAMES[r.id]) {
      renamed++;
      return { ...r, name: RENAMES[r.id] };
    }
    return r;
  });

writeFileSync(RECIPES, JSON.stringify(updated, null, 2), "utf8");

// ─── Summary ───────────────────────────────────────────────────────────────
console.log("─────────────────────────────────────────");
console.log(`  Before : ${recipes.length} recipes`);
console.log(`  Deleted: ${deleted}`);
console.log(`  Renamed: ${renamed}`);
console.log(`  After  : ${updated.length} recipes`);
console.log("─────────────────────────────────────────");
console.log("  Deletions (keeping better version):");
[
  ["r097", "r012", "Chicken Caesar Salad"],
  ["r098", "r022", "Mushroom Risotto"],
  ["r070", "r031", "Chilli Con Carne"],
  ["r080", "r050", "Creamy Mushroom Pasta"],
  ["r079", "r029+r048", "Chicken Schnitzel"],
].forEach(([removed, kept, name]) =>
  console.log(`    removed ${removed}, kept ${kept}  (${name})`)
);
console.log("─────────────────────────────────────────");
console.log("  Renames:");
Object.entries(RENAMES).forEach(([id, name]) =>
  console.log(`    ${id}  →  ${name}`)
);
console.log("─────────────────────────────────────────");

// ─── Verify no duplicate names remain ──────────────────────────────────────
const nameCounts = {};
updated.forEach((r) => {
  const key = r.name.toLowerCase().trim();
  nameCounts[key] = (nameCounts[key] || 0) + 1;
});
const remaining = Object.entries(nameCounts).filter(([, c]) => c > 1);
if (remaining.length === 0) {
  console.log("  ✓ No duplicate names remaining.");
} else {
  console.log("  ⚠ Still duplicated:");
  remaining.forEach(([name, c]) => console.log(`    "${name}" × ${c}`));
}
console.log("─────────────────────────────────────────");
