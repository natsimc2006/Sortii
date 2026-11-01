/**
 * generate-recipe-images.mjs
 * ──────────────────────────
 * Generates one owned photo per recipe with OpenAI's image API, in a single
 * Sortii house style with built-in variety, and saves them to
 * public/recipe-images/<id>.webp so the Netlify web export serves them at
 *   https://<your-site>/recipe-images/<id>.webp
 *
 * House style (fixed): realistic home cooking, soft daylight, warm colour,
 * generous but believable portions, no hands/people/text.
 * Variety (rotates): surface, vessel (chosen by dish type), camera angle
 * (chosen by vessel) and props (drawn from the recipe's own ingredients).
 * Every recipe always gets the same setup, so re-running is consistent.
 *
 * Needs OPENAI_API_KEY in the environment (Replit Secrets). Never commit it.
 *
 * Usage (from artifacts/meal-planner):
 *   node scripts/generate-recipe-images.mjs --dry-run 10   print prompts only, no API calls
 *   node scripts/generate-recipe-images.mjs --sample       generate 5 test images
 *   node scripts/generate-recipe-images.mjs --all          generate every missing image
 *   node scripts/generate-recipe-images.mjs --only r001,r003 --force   redo specific images
 *   node scripts/generate-recipe-images.mjs --review       build the review page
 *   node scripts/generate-recipe-images.mjs --apply --base-url https://your-site.netlify.app
 *       write the hosted URLs into the recipe data (only for images that exist
 *       and aren't listed in scripts/recipe-images/rejected.txt)
 *
 * Optional environment overrides:
 *   IMAGE_MODEL    default "gpt-image-2.5-flare"
 *   IMAGE_QUALITY  default "medium"   (low | medium | high)
 *   IMAGE_SIZE     default "1536x1024"
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const AU_FILE = path.join(ROOT, "data", "recipes_unified_au.json");
const UK_FILE = path.join(ROOT, "data", "recipes_uk_clean.json");
const OUT_DIR = path.join(ROOT, "public", "recipe-images");
const WORK_DIR = path.join(here, "recipe-images");
const MANIFEST = path.join(WORK_DIR, "manifest.json");
const REJECTED = path.join(WORK_DIR, "rejected.txt");
const REVIEW = path.join(WORK_DIR, "review.html");

const MODEL = process.env.IMAGE_MODEL || "gpt-image-2.5-flare";
const QUALITY = process.env.IMAGE_QUALITY || "medium";
const SIZE = process.env.IMAGE_SIZE || "1536x1024";
const CONCURRENCY = 3;
const OUTPUT_WIDTH = 900; // used only if sharp is installed

// Five recipes that cover different vessels and surfaces, for --sample
const SAMPLE_IDS = ["r001", "r003", "r008", "r058", "uk_shepherds_pie"];

// ── Recipes ──────────────────────────────────────────────────────────────────

function loadRecipes() {
  const au = JSON.parse(fs.readFileSync(AU_FILE, "utf8")).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description || "",
    ingredients: (r.ingredientsAU || r.ingredients || []).map((i) => i.name),
    cookingStyle: r.cookingStyle || "",
    file: "au",
  }));
  const uk = JSON.parse(fs.readFileSync(UK_FILE, "utf8")).map((r) => ({
    id: r.recipeId,
    name: r.title,
    description: "",
    ingredients: (r.ingredientRows || []).map((i) => i.ingredientLabel),
    cookingStyle: "",
    file: "uk",
  }));
  return [...au, ...uk];
}

// ── Setup system ─────────────────────────────────────────────────────────────

const SURFACES = [
  "a light oak timber kitchen table",
  "a soft terracotta-coloured tabletop",
  "pale sage-green ceramic tiles",
  "a warm cream linen tablecloth",
  "a pale honed marble benchtop",
  "a weathered light timber bench",
];

const TEXTILES = [
  "a crumpled natural linen napkin",
  "a folded cotton tea towel",
  "a muted teal napkin",
  "a striped linen tea towel",
];

// Ordered: first match wins
const VESSELS = [
  { test: /tray ?bake|sheet pan|one[- ]tray|one[- ]pan .*bake|sausage and veg\w* bake/, vessel: "in a well-used enamel roasting tray", angle: "directly overhead" },
  { test: /frittata|shakshuka|skillet/, vessel: "in a cast-iron skillet", angle: "directly overhead" },
  { test: /soup|chowder|laksa|pho|ramen/, vessel: "in a deep ceramic soup bowl", angle: "from a close three-quarter angle" },
  { test: /stew|casserole|bourguignon|osso buco|goulash|slow cook/, vessel: "in a cast-iron casserole pot with the lid set aside", angle: "from a close three-quarter angle" },
  { test: /pie|bake|lasagne|lasagna|gratin|moussaka|enchilada|mac and cheese|crumble/, vessel: "in a ceramic baking dish with a serving scooped out", angle: "from a 45-degree angle" },
  { test: /burger|wrap|taco|burrito|quesadilla|sandwich|toastie|scroll|pizza|kebab|souvlaki|fajita|sliders?/, vessel: "on a timber serving board", angle: "from a low 30-degree angle" },
  { test: /curry|dal|dahl|chilli|chili|tagine|korma|masala|vindaloo|rendang/, vessel: "in a deep rustic stoneware bowl", angle: "from a close three-quarter angle" },
  { test: /pasta|spaghetti|penne|linguine|fettuccine|gnocchi|noodle|stir[- ]?fry|risotto|fried rice|ragu|ragù|carbonara|bolognese/, vessel: "in a wide, low stoneware bowl", angle: "directly overhead" },
  { test: /schnitzel|steak|chop|cutlet|kofta|skewer|kebab|parmigiana/, vessel: "on a rimmed speckled ceramic plate", angle: "from a low 30-degree angle" },
  { test: /salad|bowl|poke|buddha/, vessel: "in a wide shallow ceramic bowl", angle: "directly overhead" },
  { test: /.*/, vessel: "on a rimmed speckled ceramic plate", angle: "from a low 30-degree angle" },
];

// Props come from the recipe's own ingredients so nothing appears that isn't in the dish
const PROP_RULES = [
  { test: /naan/, prop: "a small stack of warm naan" },
  { test: /\brice\b/, prop: "a small bowl of steamed rice" },
  { test: /parmesan/, prop: "a small dish of grated parmesan" },
  { test: /\blemon\b/, prop: "a halved lemon" },
  { test: /\blime\b/, prop: "a few lime wedges" },
  { test: /coriander|parsley|basil|mint|dill/, prop: "a few loose sprigs of fresh herbs" },
  { test: /bread|baguette|sourdough|ciabatta/, prop: "torn crusty bread" },
  { test: /tortilla|wrap/, prop: "a few folded tortillas" },
  { test: /chilli|chili/, prop: "a small dish of sliced fresh chilli" },
  { test: /yoghurt|yogurt|sour cream/, prop: "a small bowl of yoghurt" },
];

const UTENSILS = ["a fork resting at the edge of frame", "a brass spoon", "a pair of wooden serving spoons", "a simple knife and fork"];

const STAPLES = /^(olive oil|vegetable oil|oil|salt|pepper|black pepper|water|sugar|butter|cooking spray|plain flour|flour)$/i;

function hash(id, salt) {
  return crypto.createHash("sha1").update(`${salt}:${id}`).digest().readUInt32BE(0);
}

function pick(list, id, salt) {
  return list[hash(id, salt) % list.length];
}

export function buildSetup(recipe) {
  const text = `${recipe.name} ${recipe.description} ${recipe.cookingStyle}`.toLowerCase();
  const { vessel, angle } = VESSELS.find((v) => v.test.test(text));
  const ingredientsText = recipe.ingredients.join(" ").toLowerCase();
  const props = PROP_RULES.filter((p) => p.test.test(ingredientsText)).map((p) => p.prop);
  const sideProp = props.length ? props[hash(recipe.id, "prop") % props.length] : null;
  return {
    surface: pick(SURFACES, recipe.id, "surface"),
    vessel,
    angle,
    props: [sideProp, pick(TEXTILES, recipe.id, "textile"), pick(UTENSILS, recipe.id, "utensil")].filter(Boolean),
  };
}

export function buildPrompt(recipe, setup = buildSetup(recipe)) {
  const ingredients = recipe.ingredients
    .map((n) => n.replace(/^budget\s+/i, "").trim())
    .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
    .filter((n) => n && !STAPLES.test(n))
    .slice(0, 10);
  const what = [recipe.description, ingredients.length ? `Made with ${ingredients.join(", ")}.` : ""]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\./g, ".");
  return [
    `Realistic home-cooked food photo of ${recipe.name}.`,
    what,
    `Served ${setup.vessel} on ${setup.surface}. Shot ${setup.angle}.`,
    `Beside it: ${setup.props.join(", ")}.`,
    "Soft natural daylight, warm and inviting colour, gentle shadows.",
    "Generous realistic family portion, homely and slightly imperfect, not restaurant styling.",
    "Only show ingredients that belong in this dish.",
    "No hands, no people, no text, no logos.",
  ].join(" ");
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function generateImage(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set. Add it to Replit Secrets.");
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        n: 1,
        size: SIZE,
        quality: QUALITY,
        output_format: "webp",
        output_compression: 80,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image in response");
      return Buffer.from(b64, "base64");
    }
    const body = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === 4) {
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

let sharpLib;
async function shrink(buffer) {
  if (sharpLib === undefined) {
    try { sharpLib = (await import("sharp")).default; } catch { sharpLib = null; }
  }
  if (!sharpLib) return buffer;
  return sharpLib(buffer).resize({ width: OUTPUT_WIDTH }).webp({ quality: 78 }).toBuffer();
}

// ── Manifest ─────────────────────────────────────────────────────────────────

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch { return {}; }
}

function writeManifest(m) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
}

function readRejected() {
  try {
    return new Set(
      fs.readFileSync(REJECTED, "utf8").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    );
  } catch { return new Set(); }
}

const imagePath = (id) => path.join(OUT_DIR, `${id}.webp`);

// ── Commands ─────────────────────────────────────────────────────────────────

async function runGenerate(recipes, { force }) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Add it to Replit Secrets, then run this again.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = readManifest();
  const todo = recipes.filter((r) => force || !fs.existsSync(imagePath(r.id)));
  console.log(`Model ${MODEL}, quality ${QUALITY}, size ${SIZE}`);
  console.log(`${todo.length} image(s) to generate (${recipes.length - todo.length} already exist)\n`);

  const failures = [];
  let done = 0;
  const queue = [...todo];
  async function worker() {
    while (queue.length) {
      const r = queue.shift();
      const setup = buildSetup(r);
      const prompt = buildPrompt(r, setup);
      try {
        const img = await shrink(await generateImage(prompt));
        fs.writeFileSync(imagePath(r.id), img);
        manifest[r.id] = { name: r.name, prompt, setup, model: MODEL, quality: QUALITY, generatedAt: new Date().toISOString() };
        writeManifest(manifest);
        done++;
        console.log(`✓ ${done}/${todo.length}  ${r.id}  ${r.name}  (${Math.round(img.length / 1024)} KB)`);
      } catch (e) {
        failures.push(r.id);
        console.log(`✗ ${r.id}  ${r.name}: ${e.message}`);
        if (/OPENAI_API_KEY|401|invalid_api_key/.test(e.message)) {
          queue.length = 0;
        }
        if (/model/i.test(e.message) && /40[04]/.test(e.message)) {
          console.log(`  Tip: set IMAGE_MODEL to an image model your account can use.`);
          queue.length = 0;
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nDone: ${done} generated, ${failures.length} failed.`);
  if (failures.length) {
    console.log(`Retry the failures with:\n  node scripts/generate-recipe-images.mjs --only ${failures.join(",")} --force`);
  }
  console.log(`Then build the review page:\n  node scripts/generate-recipe-images.mjs --review`);
}

function runReview(recipes) {
  const manifest = readManifest();
  const rejected = readRejected();
  const items = recipes
    .filter((r) => fs.existsSync(imagePath(r.id)))
    .map((r) => ({
      id: r.id,
      name: r.name,
      src: path.relative(WORK_DIR, imagePath(r.id)).split(path.sep).join("/"),
      setup: manifest[r.id]?.setup,
      rejected: rejected.has(r.id),
    }));
  const missing = recipes.filter((r) => !fs.existsSync(imagePath(r.id))).length;
  const html = REVIEW_TEMPLATE
    .replace("__ITEMS__", JSON.stringify(items).replace(/</g, "\\u003c"))
    .replace("__MISSING__", String(missing));
  fs.mkdirSync(WORK_DIR, { recursive: true });
  fs.writeFileSync(REVIEW, html);
  console.log(`Review page: ${path.relative(process.cwd(), REVIEW)}  (${items.length} images, ${missing} still missing)`);
}

function runApply(recipes, baseUrl) {
  if (!/^https:\/\//.test(baseUrl || "")) {
    console.error("Pass your site address, e.g. --apply --base-url https://your-site.netlify.app");
    process.exit(1);
  }
  const base = baseUrl.replace(/\/+$/, "");
  const rejected = readRejected();
  const ready = new Set(recipes.filter((r) => fs.existsSync(imagePath(r.id)) && !rejected.has(r.id)).map((r) => r.id));
  // ?v=<content hash> so a regenerated image shows up instead of a cached old one
  const url = (id) => {
    const v = crypto.createHash("sha1").update(fs.readFileSync(imagePath(id))).digest("hex").slice(0, 8);
    return `${base}/recipe-images/${id}.webp?v=${v}`;
  };

  let updated = 0;
  for (const [file, idKey] of [[AU_FILE, "id"], [UK_FILE, "recipeId"]]) {
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    for (const r of data) {
      if (ready.has(r[idKey]) && r.imageUrl !== url(r[idKey])) {
        r.imageUrl = url(r[idKey]);
        updated++;
      }
    }
    // Keep each file's existing formatting (trailing newline or not)
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
  }
  const without = recipes.length - ready.size;
  console.log(`Updated ${updated} recipe image URLs. ${ready.size} recipes now use owned images; ${without} don't yet.`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

async function main() {
  const recipes = loadRecipes();
  const byId = new Map(recipes.map((r) => [r.id, r]));

  if (flag("--dry-run")) {
    const n = Number(value("--dry-run")) || 10;
    const list = value("--only") ? value("--only").split(",").map((id) => byId.get(id)).filter(Boolean) : recipes.slice(0, n);
    for (const r of list) console.log(`── ${r.id} ${r.name}\n${buildPrompt(r)}\n`);
  } else if (flag("--review")) {
    runReview(recipes);
  } else if (flag("--apply")) {
    runApply(recipes, value("--base-url"));
  } else if (flag("--sample")) {
    await runGenerate(SAMPLE_IDS.map((id) => byId.get(id)).filter(Boolean), { force: flag("--force") });
  } else if (flag("--only")) {
    const ids = value("--only").split(",").map((s) => s.trim());
    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length) console.log(`Unknown recipe IDs ignored: ${unknown.join(", ")}`);
    await runGenerate(ids.map((id) => byId.get(id)).filter(Boolean), { force: flag("--force") });
  } else if (flag("--all")) {
    await runGenerate(recipes, { force: flag("--force") });
  } else {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  }
}

// ── Review page template ─────────────────────────────────────────────────────

const REVIEW_TEMPLATE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sortii image review</title>
<style>
  :root { --bg:#F7F3EB; --text:#2B2B2B; --teal:#2A8F88; --gold:#D29A22; --red:#B86557; --red-tint:#F7E9E8; --border:#E6E1D7; --card:#fff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, -apple-system, sans-serif; }
  header { position:sticky; top:0; z-index:2; background:var(--bg); border-bottom:1px solid var(--border); padding:14px 16px; }
  h1 { margin:0 0 4px; font-size:20px; }
  .bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px; }
  button, select, input { font:inherit; }
  button { border:0; border-radius:10px; padding:8px 14px; cursor:pointer; background:var(--teal); color:#fff; }
  button.gold { background:var(--gold); }
  input[type=search] { padding:8px 10px; border:1px solid var(--border); border-radius:10px; min-width:180px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px; padding:16px; }
  .card { background:var(--card); border:2px solid var(--border); border-radius:14px; overflow:hidden; }
  .card.redo { border-color:var(--red); background:var(--red-tint); }
  .card img { width:100%; aspect-ratio:3/2; object-fit:cover; display:block; background:#eee; }
  .meta { padding:10px 12px; }
  .name { font-weight:600; }
  .small { font-size:12px; color:#6b665d; }
  label { display:flex; gap:6px; align-items:center; margin-top:6px; cursor:pointer; }
  pre { white-space:pre-wrap; word-break:break-all; background:#fff; border:1px solid var(--border); border-radius:10px; padding:10px; margin:8px 0 0; font-size:13px; }
</style></head>
<body>
<header>
  <h1>Sortii image review</h1>
  <div class="small"><span id="count"></span>. Tick any image to redo. __MISSING__ recipe(s) have no image yet.</div>
  <div class="bar">
    <input type="search" id="q" placeholder="Filter by name or ID">
    <button id="copy">Copy redo command</button>
    <button id="copyRejected" class="gold">Copy rejected list</button>
  </div>
  <pre id="out" hidden></pre>
</header>
<main class="grid" id="grid"></main>
<script>
  const items = __ITEMS__;
  let redo = new Set(items.filter(i => i.rejected).map(i => i.id));
  try { const saved = JSON.parse(localStorage.getItem("sortii-redo") || "null"); if (saved) redo = new Set(saved); } catch {}
  const save = () => { try { localStorage.setItem("sortii-redo", JSON.stringify([...redo])); } catch {} };
  const grid = document.getElementById("grid");
  function render() {
    const q = document.getElementById("q").value.toLowerCase();
    grid.innerHTML = "";
    for (const it of items) {
      if (q && !(it.name.toLowerCase().includes(q) || it.id.includes(q))) continue;
      const s = it.setup || {};
      const card = document.createElement("div");
      card.className = "card" + (redo.has(it.id) ? " redo" : "");
      card.innerHTML = '<img loading="lazy" alt="">' +
        '<div class="meta"><div class="name"></div><div class="small setup"></div>' +
        '<label><input type="checkbox"> Redo this one</label></div>';
      card.querySelector("img").src = it.src + "?v=" + Date.now();
      card.querySelector(".name").textContent = it.name;
      card.querySelector(".setup").textContent = it.id + " · " + [s.vessel, s.surface].filter(Boolean).join(" · ");
      const cb = card.querySelector("input");
      cb.checked = redo.has(it.id);
      cb.onchange = () => { cb.checked ? redo.add(it.id) : redo.delete(it.id); card.classList.toggle("redo", cb.checked); save(); count(); };
      grid.appendChild(card);
    }
    count();
  }
  function count() { document.getElementById("count").textContent = items.length + " images · " + redo.size + " marked to redo"; }
  function show(text) {
    const out = document.getElementById("out"); out.hidden = false; out.textContent = text;
    navigator.clipboard?.writeText(text).catch(() => {});
  }
  document.getElementById("copy").onclick = () => show(redo.size
    ? "node scripts/generate-recipe-images.mjs --only " + [...redo].join(",") + " --force"
    : "Nothing marked to redo.");
  document.getElementById("copyRejected").onclick = () => show(redo.size
    ? [...redo].join("\\n") + "\\n\\n(Paste into scripts/recipe-images/rejected.txt to keep these out of --apply)"
    : "Nothing marked.");
  document.getElementById("q").oninput = render;
  render();
</script>
</body></html>
`;

if (isMain) await main();
