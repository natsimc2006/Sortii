export type DietarySwapNeed = "vegan" | "vegetarian" | "dairy-free" | "gluten-free";

export interface DietarySwapRule {
  original: string;
  swap: string;
  note?: string;
}

export const DIETARY_SWAPS: Record<DietarySwapNeed, DietarySwapRule[]> = {
  vegan: [
    { original: "butter",       swap: "vegan butter or olive oil",     note: "Same ratio, same result" },
    { original: "milk",         swap: "oat milk or soy milk",          note: "1:1 swap, works in everything" },
    { original: "cream",        swap: "coconut cream",                 note: "Rich and plant-based" },
    { original: "egg",          swap: "flax egg (1 tbsp ground flaxseed + 3 tbsp water)", note: "Let sit 5 min" },
    { original: "chicken",      swap: "firm tofu or chickpeas",        note: "Press tofu first for best texture" },
    { original: "beef",         swap: "lentils or black beans",        note: "Great for bolognese, tacos" },
    { original: "parmesan",     swap: "nutritional yeast",             note: "2 tbsp per 30g parmesan" },
    { original: "cheese",       swap: "cashew cheese or vegan cheese", note: "Widely available now" },
    { original: "honey",        swap: "maple syrup",                   note: "Equal parts" },
    { original: "yogurt",       swap: "coconut yogurt",                note: "Works in marinades, dressings" },
    { original: "sour cream",   swap: "coconut cream + lemon juice",   note: "Dollop of coconut cream works well" },
    { original: "bacon",        swap: "smoked tempeh or coconut bacon", note: "Adds the smoky hit" },
  ],
  vegetarian: [
    { original: "chicken",      swap: "halloumi or paneer",            note: "Holds its shape when cooked" },
    { original: "beef",         swap: "lentils or mushrooms",          note: "Portobello for steaks, lentils for mince" },
    { original: "lamb",         swap: "chickpeas",                     note: "Ideal for curries and stews" },
    { original: "pork",         swap: "tempeh",                        note: "Marinate for best flavour" },
    { original: "bacon",        swap: "smoked paprika + fried capers", note: "Hits the same smoky salty notes" },
    { original: "fish",         swap: "firm tofu",                     note: "Marinate in nori + lemon for sea flavour" },
    { original: "sausage",      swap: "lentil sausages or veggie snag", note: "Most supermarkets stock them" },
    { original: "mince",        swap: "lentils or textured soy protein", note: "1:1 by volume" },
  ],
  "dairy-free": [
    { original: "butter",       swap: "olive oil or coconut oil",      note: "Use 80% of the quantity" },
    { original: "milk",         swap: "oat milk or almond milk",       note: "1:1 in savoury dishes" },
    { original: "cream",        swap: "coconut cream",                 note: "Full-fat for sauces" },
    { original: "cheese",       swap: "dairy-free cheese or omit",     note: "Nutritional yeast adds cheesy depth" },
    { original: "parmesan",     swap: "nutritional yeast + salt",      note: "2 tbsp + pinch of salt" },
    { original: "yogurt",       swap: "coconut yogurt",                note: "Unsweetened for savoury" },
    { original: "sour cream",   swap: "coconut cream",                 note: "Thickened with a squeeze of lemon" },
    { original: "cream cheese", swap: "cashew cream cheese",           note: "Available at health food stores" },
    { original: "ricotta",      swap: "firm tofu blended smooth",      note: "Works well in pasta dishes" },
    { original: "feta",         swap: "marinated tofu",                note: "Add lemon and salt to tofu" },
  ],
  "gluten-free": [
    { original: "soy sauce",    swap: "tamari",                        note: "Same flavour, certified GF" },
    { original: "flour",        swap: "rice flour or GF plain flour",  note: "1:1 for thickening" },
    { original: "pasta",        swap: "rice pasta or chickpea pasta",  note: "Cook 1–2 min less" },
    { original: "spaghetti",    swap: "rice spaghetti or zucchini noodles", note: "Both work well" },
    { original: "breadcrumbs",  swap: "almond meal or GF breadcrumbs", note: "Almond meal browns beautifully" },
    { original: "bread",        swap: "GF bread or rice cakes",        note: "Many GF options now taste great" },
    { original: "noodles",      swap: "rice noodles or glass noodles", note: "100% GF, absorb sauces well" },
    { original: "couscous",     swap: "quinoa or cauliflower rice",    note: "Quinoa cooks in 15 min" },
    { original: "tortilla",     swap: "corn tortilla or lettuce cups", note: "Corn tortillas are naturally GF" },
    { original: "wrap",         swap: "GF wrap or rice paper",         note: "Rice paper is light and works well" },
    { original: "barley",       swap: "quinoa or buckwheat",           note: "Both are naturally GF" },
    { original: "panko",        swap: "GF breadcrumbs or almond meal", note: "Almond meal crisps nicely in the oven" },
  ],
};

export function findSwapsForIngredient(
  ingredientName: string,
  need: DietarySwapNeed
): DietarySwapRule | null {
  const lower = ingredientName.toLowerCase();
  const rules = DIETARY_SWAPS[need] ?? [];
  return rules.find((r) => lower.includes(r.original)) ?? null;
}

export function getRecipeSwapsForNeed(
  ingredients: { name: string; optional?: boolean }[],
  need: DietarySwapNeed
): Array<DietarySwapRule & { original: string }> {
  const results: Array<DietarySwapRule & { original: string }> = [];
  for (const ing of ingredients) {
    if (ing.optional) continue;
    const match = findSwapsForIngredient(ing.name, need);
    if (match) {
      if (!results.find((r) => r.original === match.original)) {
        results.push({ ...match, original: ing.name });
      }
    }
  }
  return results;
}
