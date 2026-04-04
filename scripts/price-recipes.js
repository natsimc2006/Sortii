#!/usr/bin/env node
/**
 * price-recipes.js
 *
 * Uses the Anthropic API to generate costPerServeAUD estimates for all
 * recipes in scripts/recipes-for-pricing.json.
 *
 * Output: scripts/recipes-pricing-output.json
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";
import { resolve, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUT  = resolve(__dirname, "recipes-for-pricing.json");
const OUTPUT = resolve(__dirname, "recipes-pricing-output.json");

const BATCH_SIZE  = 25;
const RETRY_LIMIT = 1;
const BATCH_DELAY = 1000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert in Australian household grocery costs. Estimate a realistic costPerServeAUD for each recipe based on 2025 Woolworths/Coles prices for a standard Australian household.

Rules:
- Assume home brand for pantry staples (pasta, rice, canned goods, oil, spices, flour, stock)
- Assume standard or home brand for dairy
- Use realistic supermarket prices for fresh produce, meat, seafood
- Estimate total recipe cost then divide by servings count provided
- Round to 2 decimal places

Australian price benchmarks:
- Chicken breast: $10/kg, thighs: $7/kg, mince: $8/kg
- Beef mince: $9/kg, steak cuts: $18-25/kg
- Pork mince/shoulder: $9/kg
- Lamb mince: $11/kg, cutlets: $22/kg
- Fish fillets: $16/kg, salmon: $22/kg, prawns: $20/kg
- Eggs: $5/dozen
- Milk: $2/2L, cream: $3, butter: $4/250g
- Cheddar cheese: $8/500g, parmesan: $6/100g
- Pasta/rice/noodles (home brand): $1.50-2/500g
- Canned tomatoes: $1.20, canned beans/lentils: $1.20-1.50
- Fresh vegetables (average): $3-5/bunch or bag
- Onion/garlic/ginger: $0.50-1 per recipe use
- Olive oil per recipe use: $0.30
- Dried herbs/spices per recipe use: $0.20
- Soy sauce/fish sauce/oyster sauce per recipe use: $0.30
- Coconut milk (can): $2.50
- Stock per recipe use: $2.00
- Avocado: $2.50 each
- Fresh herbs (bunch): $3.00

Return ONLY a valid JSON array, no explanation, no markdown, no code fences. Format exactly:
[
  { "id": "recipe-id", "costPerServeAUD": 6.50 },
  { "id": "recipe-id", "costPerServeAUD": 4.20 }
]`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function priceBatch(batch, batchIndex, totalBatches, attempt = 0) {
  const userMessage = `Price these recipes. Return only the JSON array.\n\n${JSON.stringify(batch, null, 2)}`;

  let rawText = "";
  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userMessage }],
    });

    rawText = response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown code fences if the model wraps the response
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    console.log(`  Batch ${batchIndex}/${totalBatches} complete — ${parsed.length} recipes priced`);
    return parsed;
  } catch (err) {
    if (attempt < RETRY_LIMIT) {
      console.warn(`  Batch ${batchIndex}/${totalBatches} failed (${err.message}) — retrying...`);
      await sleep(2000);
      return priceBatch(batch, batchIndex, totalBatches, attempt + 1);
    }
    if (rawText) {
      console.error(`  Batch ${batchIndex}/${totalBatches} JSON parse failed. Raw response:\n${rawText}`);
    } else {
      console.error(`  Batch ${batchIndex}/${totalBatches} API call failed: ${err.message}`);
    }
    return [];
  }
}

async function main() {
  const allRecipes = JSON.parse(readFileSync(INPUT, "utf8"));
  const total = allRecipes.length;

  const batches = [];
  for (let i = 0; i < total; i += BATCH_SIZE) {
    batches.push(allRecipes.slice(i, i + BATCH_SIZE));
  }

  console.log("─────────────────────────────────────────────");
  console.log(`  Recipes to price : ${total}`);
  console.log(`  Batches          : ${batches.length} × ${BATCH_SIZE}`);
  console.log(`  Model            : claude-haiku-4-5-20251001`);
  console.log("─────────────────────────────────────────────");

  const results = [];
  let skipped = 0;

  for (let i = 0; i < batches.length; i++) {
    const batchResults = await priceBatch(batches[i], i + 1, batches.length);

    if (batchResults.length === 0) {
      skipped += batches[i].length;
    } else {
      results.push(...batchResults);
    }

    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY);
    }
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), "utf8");

  console.log("─────────────────────────────────────────────");
  console.log(`  Successfully priced : ${results.length}`);
  console.log(`  Skipped (errors)    : ${skipped}`);
  console.log(`  Output file         : ${relative(process.cwd(), OUTPUT)}`);
  console.log("─────────────────────────────────────────────");
  console.log("  Sample (first 5 results):");
  results.slice(0, 5).forEach((r) =>
    console.log(`    ${r.id.padEnd(6)}  $${r.costPerServeAUD.toFixed(2)}/serve`)
  );
  console.log("─────────────────────────────────────────────");
  console.log("  Review the output, then confirm to proceed with import.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
