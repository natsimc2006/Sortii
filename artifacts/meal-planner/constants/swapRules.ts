export type SwapRule = {
  id: string;
  matchKeywords: string[];
  swapLabel: string;
  savingPerServeAUD: number;
  tip: string;
};

export const SWAP_RULES: SwapRule[] = [
  // PROTEIN SWAPS
  {
    id: "swap-breast-to-thigh",
    matchKeywords: ["chicken breast"],
    swapLabel: "chicken thigh",
    savingPerServeAUD: 1.50,
    tip: "Thighs are juicier anyway.",
  },
  {
    id: "swap-lamb-to-beef",
    matchKeywords: ["lamb mince", "lamb"],
    swapLabel: "beef mince",
    savingPerServeAUD: 1.00,
    tip: "Works in any mince dish.",
  },
  {
    id: "swap-salmon-to-barramundi",
    matchKeywords: ["salmon"],
    swapLabel: "barramundi or flathead",
    savingPerServeAUD: 2.50,
    tip: "Local fish, better value.",
  },
  {
    id: "swap-prawns-to-fish",
    matchKeywords: ["prawn", "prawns", "shrimp"],
    swapLabel: "fish fillets",
    savingPerServeAUD: 2.00,
    tip: "Same vibe, easier on the wallet.",
  },
  {
    id: "swap-beef-steak-to-mince",
    matchKeywords: ["beef steak", "sirloin", "ribeye", "scotch fillet"],
    swapLabel: "beef mince",
    savingPerServeAUD: 4.00,
    tip: "Mince works harder for less.",
  },

  // PANTRY SWAPS
  {
    id: "swap-branded-pasta",
    matchKeywords: ["pasta", "spaghetti", "penne", "fettuccine", "linguine"],
    swapLabel: "home brand pasta",
    savingPerServeAUD: 0.50,
    tip: "Tastes the same. Promise.",
  },
  {
    id: "swap-branded-rice",
    matchKeywords: ["rice", "jasmine rice", "basmati rice"],
    swapLabel: "home brand rice",
    savingPerServeAUD: 0.40,
    tip: "No difference in the bowl.",
  },
  {
    id: "swap-branded-stock",
    matchKeywords: ["stock", "chicken stock", "beef stock", "vegetable stock"],
    swapLabel: "home brand stock",
    savingPerServeAUD: 0.40,
    tip: "Home brand stocks are fine.",
  },
  {
    id: "swap-branded-canned-tomatoes",
    matchKeywords: ["canned tomatoes", "tinned tomatoes", "crushed tomatoes"],
    swapLabel: "home brand canned tomatoes",
    savingPerServeAUD: 0.30,
    tip: "Same tomatoes, different label.",
  },
  {
    id: "swap-coconut-cream-to-milk",
    matchKeywords: ["coconut cream"],
    swapLabel: "coconut milk",
    savingPerServeAUD: 0.50,
    tip: "Lighter but works just as well.",
  },

  // PRODUCE SWAPS
  {
    id: "swap-avocado-remove",
    matchKeywords: ["avocado"],
    swapLabel: "skip it",
    savingPerServeAUD: 1.25,
    tip: "Optional in most dishes.",
  },
  {
    id: "swap-fresh-herbs-to-dried",
    matchKeywords: [
      "fresh basil", "fresh coriander", "fresh parsley",
      "fresh thyme", "fresh rosemary", "fresh oregano",
    ],
    swapLabel: "dried herbs",
    savingPerServeAUD: 0.80,
    tip: "Use ⅓ of the quantity.",
  },
  {
    id: "swap-broccolini-to-broccoli",
    matchKeywords: ["broccolini"],
    swapLabel: "broccoli",
    savingPerServeAUD: 0.80,
    tip: "Cut smaller, same result.",
  },
  {
    id: "swap-baby-spinach-to-spinach",
    matchKeywords: ["baby spinach"],
    swapLabel: "frozen spinach",
    savingPerServeAUD: 0.60,
    tip: "Frozen is fine in cooked dishes.",
  },
  {
    id: "swap-pine-nuts",
    matchKeywords: ["pine nuts"],
    swapLabel: "sunflower seeds or slivered almonds",
    savingPerServeAUD: 1.50,
    tip: "Same crunch, fraction of the price.",
  },
  {
    id: "swap-parmesan-to-pecorino",
    matchKeywords: ["parmesan"],
    swapLabel: "home brand parmesan",
    savingPerServeAUD: 0.60,
    tip: "Pre-grated home brand is fine.",
  },

  // DAIRY SWAPS
  {
    id: "swap-thickened-cream",
    matchKeywords: ["thickened cream", "heavy cream", "double cream"],
    swapLabel: "light cream or evaporated milk",
    savingPerServeAUD: 0.50,
    tip: "Works in sauces and soups.",
  },
  {
    id: "swap-branded-butter",
    matchKeywords: ["butter"],
    swapLabel: "home brand butter",
    savingPerServeAUD: 0.30,
    tip: "Bakes and cooks identically.",
  },
];
