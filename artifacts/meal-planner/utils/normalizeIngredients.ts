const SYNONYM_MAP: Record<string, string> = {
  // ── Beef / mince ──────────────────────────────────────────────────────────
  mince: "beef mince",
  "minced beef": "beef mince",
  "ground beef": "beef mince",
  "beef mince": "beef mince",
  "beef": "beef mince",

  // ── Corned beef ───────────────────────────────────────────────────────────
  "tinned corned beef": "corned beef",
  "canned corned beef": "corned beef",

  // ── Cheese ───────────────────────────────────────────────────────────────
  "shredded cheese": "cheese",
  "grated cheese": "cheese",
  cheddar: "cheese",
  parmesan: "cheese",
  mozzarella: "cheese",
  "block cheese": "cheese",

  // ── Tomatoes ──────────────────────────────────────────────────────────────
  "canned tomatoes": "tinned tomatoes",
  "crushed tomatoes": "tinned tomatoes",
  "diced tomatoes": "tinned tomatoes",
  "tomato tin": "tinned tomatoes",
  "tinned toms": "tinned tomatoes",
  "canned toms": "tinned tomatoes",
  "tin of tomatoes": "tinned tomatoes",
  "can of tomatoes": "tinned tomatoes",

  // ── Veg / freezer ─────────────────────────────────────────────────────────
  "frozen veg": "mixed veg",
  "frozen vegetables": "mixed veg",
  "frozen veggies": "mixed veg",
  "freezer veg": "mixed veg",
  "freezer vegetables": "mixed veg",
  "random veg": "mixed veg",
  "random freezer veg": "mixed veg",
  veggies: "mixed veg",
  veg: "mixed veg",

  // ── Capsicum / pepper ─────────────────────────────────────────────────────
  "bell pepper": "capsicum",
  "red pepper": "capsicum",
  "green pepper": "capsicum",
  "yellow pepper": "capsicum",
  pepper: "capsicum",

  // ── Wraps / flatbread ─────────────────────────────────────────────────────
  "tortilla wraps": "wraps",
  tortilla: "wraps",
  tortillas: "wraps",
  flatbread: "wraps",
  pitta: "wraps",
  pita: "wraps",
  wrap: "wraps",

  // ── Noodles ───────────────────────────────────────────────────────────────
  ramen: "noodles",
  "ramen noodles": "noodles",
  "rice noodles": "noodles",
  "egg noodles": "noodles",
  "udon noodles": "noodles",
  noodle: "noodles",

  // ── Pasta ─────────────────────────────────────────────────────────────────
  spaghetti: "pasta",
  penne: "pasta",
  fettuccine: "pasta",
  macaroni: "pasta",
  rigatoni: "pasta",
  linguine: "pasta",

  // ── Chicken ───────────────────────────────────────────────────────────────
  "minced chicken": "chicken",
  "chicken thigh": "chicken",
  "chicken thighs": "chicken",
  "chicken breast": "chicken",
  "chicken breasts": "chicken",
  "chicken fillets": "chicken",
  "shredded chicken": "chicken",
  "cooked chicken": "chicken",
  "rotisserie chicken": "chicken",
  "leftover chicken": "chicken",

  // ── Sausages ──────────────────────────────────────────────────────────────
  sausages: "sausage",
  "beef sausage": "sausage",
  "pork sausage": "sausage",
  "snags": "sausage",

  // ── Beans / legumes ───────────────────────────────────────────────────────
  "baked beans": "beans",
  "kidney beans": "beans",
  chickpeas: "beans",
  lentils: "beans",
  "black beans": "beans",
  "cannellini beans": "beans",
  "tinned beans": "beans",
  "canned beans": "beans",

  // ── Tofu ──────────────────────────────────────────────────────────────────
  "silken tofu": "tofu",
  "firm tofu": "tofu",

  // ── Bacon ─────────────────────────────────────────────────────────────────
  rasher: "bacon",
  rashers: "bacon",
  "bacon rashers": "bacon",

  // ── Potatoes ──────────────────────────────────────────────────────────────
  "sweet potato": "potatoes",
  "sweet potatoes": "potatoes",
  potato: "potatoes",
  spud: "potatoes",
  spuds: "potatoes",
  "baby potatoes": "potatoes",

  // ── Broccoli ──────────────────────────────────────────────────────────────
  "broccoli florets": "broccoli",

  // ── Peas / corn ───────────────────────────────────────────────────────────
  "frozen peas": "peas",
  "frozen corn": "corn",
  "sweet corn": "corn",
  sweetcorn: "corn",
  "tinned corn": "corn",
  "canned corn": "corn",

  // ── Onion ─────────────────────────────────────────────────────────────────
  "spring onion": "onion",
  "green onion": "onion",
  shallot: "onion",
  shallots: "onion",
  "red onion": "onion",
  "half an onion": "onion",
  "half onion": "onion",

  // ── Cream ─────────────────────────────────────────────────────────────────
  "heavy cream": "cream",
  "whipping cream": "cream",
  "sour cream": "cream",
  "creme fraiche": "cream",
  "cooking cream": "cream",
  "double cream": "cream",

  // ── Stock ─────────────────────────────────────────────────────────────────
  "chicken broth": "stock",
  "beef broth": "stock",
  "vegetable broth": "stock",
  "stock cube": "stock",
  bullion: "stock",
  "chicken stock": "stock",
  "veg stock": "stock",
  "beef stock": "stock",

  // ── Soy sauce ─────────────────────────────────────────────────────────────
  "light soy": "soy sauce",
  "dark soy": "soy sauce",
  tamari: "soy sauce",

  // ── Pesto ─────────────────────────────────────────────────────────────────
  "basil pesto": "pesto",
  "red pesto": "pesto",

  // ── Curry paste ───────────────────────────────────────────────────────────
  "red curry paste": "curry paste",
  "green curry paste": "curry paste",
  "thai curry paste": "curry paste",
  "curry powder": "curry paste",

  // ── Mayo ──────────────────────────────────────────────────────────────────
  mayonnaise: "mayo",
  aioli: "mayo",

  // ── Tuna ──────────────────────────────────────────────────────────────────
  "canned tuna": "tuna",
  "tinned tuna": "tuna",
  "tuna can": "tuna",
  "tuna tin": "tuna",
  "tin of tuna": "tuna",

  // ── Eggs ──────────────────────────────────────────────────────────────────
  egg: "eggs",

  // ── Couscous ──────────────────────────────────────────────────────────────
  couscous: "couscous",
  "instant couscous": "couscous",
};

export function normalizeIngredient(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return SYNONYM_MAP[lower] ?? lower;
}

export function normalizeIngredients(items: string[]): string[] {
  return [...new Set(items.map(normalizeIngredient).filter((s) => s.length >= 2))];
}
