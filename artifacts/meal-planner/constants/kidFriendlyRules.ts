export const DISQUALIFYING_INGREDIENTS: string[] = [
  "chilli", "chili", "chilli flakes", "chili flakes", "red chilli", "green chilli",
  "sriracha", "harissa", "curry paste", "red curry paste", "green curry paste",
  "curry powder", "garam masala", "cayenne", "cayenne pepper",
  "smoked paprika", "hot paprika", "wasabi", "horseradish",
  "fish sauce", "anchovies", "anchovy",
  "blue cheese", "brie", "goat cheese", "gorgonzola", "camembert", "feta",
  "offal", "liver", "mussels", "oysters", "squid", "octopus",
  "wine", "white wine", "red wine", "beer", "brandy", "whiskey", "whisky", "spirits",
];

export const DISQUALIFYING_DISH_PATTERNS: RegExp[] = [
  /\bcurry\b/i,
  /\bkorma\b/i,
  /\btikka\b/i,
  /\bmasala\b/i,
  /\bvindaloo\b/i,
  /\bbiryani\b/i,
  /butter\s*chicken/i,
  /\brendang\b/i,
  /\bdhal\b|\bdal\b/i,
  /\blaksa\b/i,
  /\bramen\b/i,
  /\bpho\b/i,
  /tom\s*yum/i,
  /pad\s*thai/i,
  /dan\s*dan/i,
  /\bchowder\b/i,
  /\bbisque\b/i,
  /\bspicy\b/i,
  /szechuan|sichuan/i,
  /\bgochujang\b/i,
  /\bchipotle\b/i,
  /\bjalaペ|\bjalape/i,
  /\bsriracha\b/i,
  /\bwasabi\b/i,
  /\bbiryani\b/i,
];

export const QUALIFYING_DISH_PATTERNS: RegExp[] = [
  /spaghetti\s*bol|bolognese/i,
  /mac\s*(and|&|'?n'?)\s*cheese|macaroni\s*cheese/i,
  /\blasagne\b|\blasagna\b/i,
  /pasta\s*bake/i,
  /\bpizza\b/i,
  /\bburger\b/i,
  /\bnugget\b/i,
  /\bschnitzel\b/i,
  /fish\s*(and|&|n)\s*chip/i,
  /fish\s*finger/i,
  /fried\s*rice/i,
  /quesadilla/i,
  /\btaco\b/i,
  /shepherd.?s\s*pie|cottage\s*pie/i,
  /\bmeatball\b/i,
  /sausage.*mash|bangers.*mash|mash.*sausage/i,
  /toad.*hole/i,
  /\bpancake\b/i,
  /\bfrittata\b/i,
  /toastie|toasted\s*sand/i,
  /pizza\s*scroll/i,
  /corn\s*dog/i,
  /honey\s*soy.*chicken|chicken.*honey\s*soy/i,
  /crumbed\s*chicken|chicken\s*(tender|strip|finger|nugget)/i,
  /pumpkin\s*soup/i,
  /tomato\s*soup/i,
  /\bscrambled\s*egg/i,
  /baked\s*bean/i,
  /\bpastie\b|\bpasty\b/i,
  /sausage\s*roll/i,
  /potato\s*wedge/i,
  /loaded\s*potato/i,
  /creamy\s*chicken\s*pasta/i,
  /\bschnitzel\b/i,
  /chicken.*rice.*(bake|simple|plain|one.pan)/i,
  /bbq\s*chicken|baked.*bbq.*chicken/i,
  /\bomelette\b/i,
  /butter.*pasta|pasta.*butter/i,
  /pesto\s*pasta/i,
  /\bspaghetti\b.*parmesan|parmesan.*\bspaghetti\b/i,
  /corn\s*fritter/i,
  /\bwrap\b.*chicken|chicken.*\bwrap\b/i,
  /ham.*cheese.*toast|toasted.*ham/i,
  /vegemite.*scroll|scroll.*vegemite/i,
  /chicken.*corn.*soup|corn.*chicken.*soup/i,
];

export function getKidFriendlyScore(recipe: {
  name: string;
  description?: string;
  ingredients?: { name: string }[];
  cuisineType?: string;
  difficulty?: string;
  estimatedCostBand?: string;
  cookTimeMinutes?: number;
}): 0 | 1 | 2 {
  const nameAndDesc = (
    (recipe.name || "") + " " + (recipe.description || "")
  ).toLowerCase();
  const ingredientNames = (recipe.ingredients || [])
    .map((i) => i.name.toLowerCase())
    .join(" ");

  for (const pattern of DISQUALIFYING_DISH_PATTERNS) {
    if (pattern.test(nameAndDesc)) return 0;
  }

  for (const ingr of DISQUALIFYING_INGREDIENTS) {
    if (ingredientNames.includes(ingr.toLowerCase())) return 0;
  }

  if (
    /\bwine\b|\bbeer\b|\bbrandy\b|\bwhiske/i.test(ingredientNames)
  ) return 0;

  for (const pattern of QUALIFYING_DISH_PATTERNS) {
    if (pattern.test(nameAndDesc)) return 2;
  }

  return 1;
}
