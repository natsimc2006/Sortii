const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ukFilePath = path.join(__dirname, '../data/recipes_uk_clean.json');
const ukRecipes = JSON.parse(fs.readFileSync(ukFilePath, 'utf8'));

const needsPricing = ukRecipes.filter(r => r.pricingNote === 'estimated_haiku_pending');

console.log(`Found ${needsPricing.length} UK recipes needing Haiku pricing pass`);
console.log('Recipes:', needsPricing.map(r => r.title || r.recipeId).join(', '));
console.log('');

const SYSTEM_PROMPT = `You are an expert in UK household grocery costs. 
Estimate a realistic costPerServeGBP for each recipe based on 2025 Tesco, 
Asda, and Aldi prices for a standard UK household.

Rules:
- Use own-brand / value range for pantry staples (pasta, rice, canned goods, 
  oil, spices, flour, stock)
- Use standard or own-brand for dairy
- Use realistic UK supermarket prices for fresh produce, meat, and fish
- Estimate total recipe cost then divide by the serves count provided
- Round to 2 decimal places
- Aim for Aldi/Asda mid-point pricing — not premium supermarket prices

UK price benchmarks (2025):
- Chicken breast: £6.50/kg, thighs: £4.50/kg, mince: £5/kg
- Beef mince (20% fat): £5/kg, steak cuts: £12-18/kg
- Pork mince/shoulder: £5/kg, sausages: £2.50 for 6-8
- Lamb mince: £7/kg
- Fish fillets: £8/kg, salmon: £12/kg, prawns (frozen): £8/kg
- Eggs (12 free range): £2.80
- Milk (4 pint): £1.25, double cream: £1.20, butter: £1.65/250g
- Cheddar cheese: £3.50/400g, parmesan: £2/100g
- Pasta/rice/noodles (own brand): £0.80-1.20/500g
- Canned tomatoes: £0.40, canned beans/lentils: £0.45-0.65
- Passata (500g): £0.75
- Fresh vegetables (average): £0.80-1.50 per item/bunch
- Onion: £0.15 each, garlic: £0.50 per bulb
- Olive oil per recipe use: £0.20
- Dried herbs/spices per recipe use: £0.10
- Soy/fish/oyster sauce per recipe use: £0.15
- Coconut milk (can): £0.85
- Stock cubes per recipe use: £0.20
- Couscous (500g own brand): £0.90
- Halloumi: £2.20 per 225g block
- Bread (800g loaf): £0.75

Return ONLY a valid JSON array. No explanation, no markdown, no code fences.
Format exactly:
[
  { "recipeId": "uk_recipe_id", "costPerServeGBP": 1.65 },
  { "recipeId": "uk_recipe_id", "costPerServeGBP": 0.95 }
]`;

async function priceBatch(recipes) {
  const recipeData = recipes.map(r => ({
    recipeId: r.recipeId,
    title: r.title,
    serves: r.serves || 4,
    ingredients: r.ingredientRows || [],
  }));

  const userMessage = `Price these UK recipes. Return only the JSON array.\n\n${JSON.stringify(recipeData, null, 2)}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0]?.text || '';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

async function main() {
  if (needsPricing.length === 0) {
    console.log('No recipes need pricing — all done!');
    return;
  }

  const BATCH_SIZE = 10;
  const results = [];
  const batches = [];
  for (let i = 0; i < needsPricing.length; i += BATCH_SIZE) {
    batches.push(needsPricing.slice(i, i + BATCH_SIZE));
  }

  console.log(`Running ${batches.length} batch(es) of up to ${BATCH_SIZE} recipes each`);
  console.log('');

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Batch ${i + 1}/${batches.length} — pricing ${batch.length} recipes...`);

    let attempt = 0;
    let success = false;

    while (attempt < 2 && !success) {
      try {
        const batchResults = await priceBatch(batch);
        results.push(...batchResults);
        console.log(`  ✅ Batch ${i + 1} complete — ${batchResults.length} recipes priced`);
        batchResults.forEach(r => {
          console.log(`     ${r.recipeId}: £${r.costPerServeGBP}/serve`);
        });
        success = true;
      } catch (err) {
        attempt++;
        if (attempt < 2) {
          console.log(`  ⚠️  Batch ${i + 1} failed, retrying in 2s... (${err.message})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`  ❌ Batch ${i + 1} failed after retry — skipping`);
          console.log(`     Error: ${err.message}`);
        }
      }
    }

    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('');
  console.log(`Pricing complete — ${results.length}/${needsPricing.length} recipes priced`);

  const priceMap = {};
  results.forEach(r => { priceMap[r.recipeId] = r.costPerServeGBP; });

  const updatedRecipes = ukRecipes.map(recipe => {
    if (priceMap[recipe.recipeId] !== undefined) {
      const newCost = priceMap[recipe.recipeId];
      const serves = recipe.serves || 4;
      return {
        ...recipe,
        estimatedCostPerServeGBP: newCost,
        estimatedRecipeCostGBP: parseFloat((newCost * serves).toFixed(2)),
        pricingNote: 'haiku_priced',
      };
    }
    return recipe;
  });

  fs.writeFileSync(ukFilePath, JSON.stringify(updatedRecipes, null, 2));
  console.log(`✅ recipes_uk_clean.json updated with Haiku pricing`);

  const stillPending = updatedRecipes.filter(r => r.pricingNote === 'estimated_haiku_pending');
  if (stillPending.length > 0) {
    console.log(`⚠️  ${stillPending.length} recipes still have estimated pricing:`);
    stillPending.forEach(r => console.log(`   - ${r.title || r.recipeId}`));
  } else {
    console.log('✅ All UK recipes now have Haiku-verified GBP pricing');
  }

  console.log('');
  console.log('Sample output (first 5 priced):');
  results.slice(0, 5).forEach(r => {
    console.log(`  ${r.recipeId}: £${r.costPerServeGBP}/serve`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
