import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { generateFallbackMeal } from "@/utils/generateFallbackMeal";
import { normalizeIngredients } from "@/utils/normalizeIngredients";
import { parseIngredientText } from "@/utils/parseIngredientText";
import { scoreAndRankRecipes } from "@/utils/scoreRecipeMatch";
import {
  CookWithPreference,
  CookWithResults,
  FallbackMealIdea,
  RecipeMatchResult,
  RescueMealIdea,
} from "@/utils/cookWithTypes";

const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";

type SectionId = "protein" | "base" | "veg" | "extras";

const SECTION_DEFS: { id: SectionId; label: string; chips: string[] }[] = [
  {
    id: "protein",
    label: "What protein do you have?",
    chips: ["chicken", "beef mince", "eggs", "tuna", "beans", "tofu", "bacon", "sausage", "corned beef"],
  },
  {
    id: "base",
    label: "Any base items?",
    chips: ["pasta", "rice", "noodles", "wraps", "bread", "potatoes", "couscous"],
  },
  {
    id: "veg",
    label: "Any veg or freezer bits?",
    chips: [
      "onion", "carrots", "broccoli", "spinach", "peas",
      "corn", "mixed veg", "capsicum", "mushrooms",
    ],
  },
  {
    id: "extras",
    label: "Anything to pull it together?",
    chips: ["cheese", "tinned tomatoes", "cream", "stock", "soy sauce", "pesto", "curry paste", "mayo", "lemon"],
  },
];

const PREF_DEFS: { id: CookWithPreference; label: string }[] = [
  { id: "fastest",          label: "fastest" },
  { id: "cheapest",         label: "cheapest" },
  { id: "kid-friendly",     label: "kid-friendly" },
  { id: "low-effort",       label: "low effort" },
  { id: "one-pan",          label: "one pan" },
  { id: "use-fridge-first", label: "clear the fridge" },
  { id: "15-min-max",       label: "15 min max" },
];

// ── Recipe result card ────────────────────────────────────────────────────────
function RecipeCard({ result }: { result: RecipeMatchResult }) {
  const C = Colors.light;
  const isReady = result.category === "ready_now";
  const accent  = isReady ? TEAL : GOLD;
  const label   = isReady ? "Ready now" : "Almost there";

  const noteIsRequired = result.missingNote.startsWith("Needs:");
  const noteColor = noteIsRequired ? GOLD : C.textMuted;

  return (
    <View style={[st.card, { backgroundColor: C.card, borderColor: accent + "38" }]}>
      <View style={[st.badge, { backgroundColor: accent + "14" }]}>
        <Text style={[st.badgeText, { color: accent }]}>{label}</Text>
      </View>
      <Text style={[st.cardName, { color: C.text }]}>{result.recipeName}</Text>
      <Text style={[st.cardReason, { color: C.textSecondary }]}>{result.reason}</Text>
      <View style={st.metaRow}>
        <View style={st.metaItem}>
          <Feather name="clock" size={11} color={C.textMuted} />
          <Text style={[st.metaText, { color: C.textMuted }]}>{result.cookTimeMinutes} mins</Text>
        </View>
        <View style={st.metaItem}>
          <Feather name="bar-chart-2" size={11} color={C.textMuted} />
          <Text style={[st.metaText, { color: C.textMuted }]}>{result.difficulty}</Text>
        </View>
        {result.isOnePan && (
          <View style={st.metaItem}>
            <Feather name="layers" size={11} color={C.textMuted} />
            <Text style={[st.metaText, { color: C.textMuted }]}>one pan</Text>
          </View>
        )}
        {result.isKidFriendly && (
          <View style={st.metaItem}>
            <Feather name="heart" size={11} color={C.textMuted} />
            <Text style={[st.metaText, { color: C.textMuted }]}>kid-friendly</Text>
          </View>
        )}
      </View>
      {!!result.missingNote && (
        <Text style={[st.missingNote, { color: noteColor }]}>{result.missingNote}</Text>
      )}
    </View>
  );
}

// ── Rescue card ───────────────────────────────────────────────────────────────
function RescueCard({ idea }: { idea: RescueMealIdea }) {
  const C = Colors.light;
  return (
    <View style={[st.card, { backgroundColor: C.card, borderColor: PLUM + "30" }]}>
      <View style={[st.badge, { backgroundColor: PLUM + "12" }]}>
        <Text style={[st.badgeText, { color: PLUM }]}>Rescue option</Text>
      </View>
      <Text style={[st.cardName, { color: C.text }]}>{idea.title}</Text>
      <Text style={[st.cardReason, { color: C.textSecondary }]}>{idea.reason}</Text>
      {idea.steps.map((step, i) => (
        <View key={i} style={st.stepRow}>
          <Text style={[st.stepNum, { color: PLUM }]}>{i + 1}.</Text>
          <Text style={[st.stepText, { color: C.textSecondary }]}>{step}</Text>
        </View>
      ))}
      <View style={st.metaRow}>
        <View style={st.metaItem}>
          <Feather name="clock" size={11} color={C.textMuted} />
          <Text style={[st.metaText, { color: C.textMuted }]}>{idea.cookTime}</Text>
        </View>
        <View style={st.metaItem}>
          <Feather name="zap" size={11} color={C.textMuted} />
          <Text style={[st.metaText, { color: C.textMuted }]}>{idea.effort}</Text>
        </View>
      </View>
    </View>
  );
}

// ── AI fallback card ──────────────────────────────────────────────────────────
function FallbackCard({ idea }: { idea: FallbackMealIdea }) {
  const C = Colors.light;
  return (
    <View style={[st.card, { backgroundColor: C.card, borderColor: PLUM + "22" }]}>
      <View style={[st.badge, { backgroundColor: PLUM + "10" }]}>
        <Text style={[st.badgeText, { color: PLUM }]}>Sortii idea</Text>
      </View>
      <Text style={[st.cardName, { color: C.text }]}>{idea.title}</Text>
      <Text style={[st.cardReason, { color: C.textSecondary }]}>{idea.reason}</Text>
      {idea.steps.map((step, i) => (
        <View key={i} style={st.stepRow}>
          <Text style={[st.stepNum, { color: PLUM }]}>{i + 1}.</Text>
          <Text style={[st.stepText, { color: C.textSecondary }]}>{step}</Text>
        </View>
      ))}
      <View style={st.metaRow}>
        <View style={st.metaItem}>
          <Feather name="clock" size={11} color={C.textMuted} />
          <Text style={[st.metaText, { color: C.textMuted }]}>{idea.cookTime}</Text>
        </View>
        <View style={st.metaItem}>
          <Feather name="zap" size={11} color={C.textMuted} />
          <Text style={[st.metaText, { color: C.textMuted }]}>{idea.effort}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────
function ResultSection({
  label,
  dotColor,
  spaceTop,
}: {
  label: string;
  dotColor: string;
  spaceTop?: boolean;
}) {
  const C = Colors.light;
  return (
    <View style={[st.sectionHeader, spaceTop && { marginTop: 32 }]}>
      <View style={[st.sectionDot, { backgroundColor: dotColor }]} />
      <Text style={[st.sectionLabel, { color: C.text }]}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CookWithScreen() {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const C         = Colors.light;
  const scrollRef = useRef<ScrollView>(null);

  // ── Input state ──
  const [freeText, setFreeText]   = useState("");
  const [chipSel, setChipSel]     = useState<Record<SectionId, string[]>>({
    protein: [], base: [], veg: [], extras: [],
  });
  const [customItems, setCustomItems] = useState<Record<SectionId, string[]>>({
    protein: [], base: [], veg: [], extras: [],
  });
  const [customInputs, setCustomInputs] = useState<Record<SectionId, string>>({
    protein: "", base: "", veg: "", extras: "",
  });
  const [preferences, setPreferences] = useState<CookWithPreference[]>([]);

  // ── View state ──
  const [view, setView]                       = useState<"input" | "loading" | "results">("input");
  const [results, setResults]                 = useState<CookWithResults | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  function toggleChip(sid: SectionId, chip: string) {
    Keyboard.dismiss();
    setChipSel((prev) => {
      const cur     = prev[sid] || [];
      const already = cur.includes(chip);
      return { ...prev, [sid]: already ? cur.filter((c) => c !== chip) : [...cur, chip] };
    });
  }

  function togglePref(id: CookWithPreference) {
    Keyboard.dismiss();
    setPreferences((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function commitCustom(sid: SectionId) {
    const text = customInputs[sid]?.trim().toLowerCase();
    if (!text) return;
    setCustomItems((prev) => ({ ...prev, [sid]: [...(prev[sid] || []), text] }));
    setCustomInputs((prev) => ({ ...prev, [sid]: "" }));
  }

  function removeCustom(sid: SectionId, item: string) {
    setCustomItems((prev) => ({ ...prev, [sid]: (prev[sid] || []).filter((i) => i !== item) }));
  }

  async function handleRun() {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setView("loading");

    // Collect ingredients from chips + custom items
    const allSelected: string[] = [];
    for (const sid of Object.keys(chipSel) as SectionId[]) {
      chipSel[sid].forEach((c) => allSelected.push(c));
      customItems[sid].forEach((c) => allSelected.push(c));
    }

    // Parse free text for additional ingredients and preferences
    const { ingredients: parsedIng, preferences: parsedPrefs } =
      parseIngredientText(freeText);

    const allIngredients = normalizeIngredients([...allSelected, ...parsedIng]);
    const allPrefs = [...new Set([...preferences, ...parsedPrefs])] as CookWithPreference[];

    // Brief pause so the transition feels intentional, not instant
    await new Promise((r) => setTimeout(r, 500));

    const local = scoreAndRankRecipes(allIngredients, allPrefs);
    setResults(local);
    setView("results");
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    // Trigger AI fallback when readyNow + rescue is thin
    const needsFallback = local.readyNow.length + local.rescue.length < 2;
    if (needsFallback && allIngredients.length >= 1) {
      setFallbackLoading(true);
      generateFallbackMeal(allIngredients, allPrefs).then((fallback) => {
        setFallbackLoading(false);
        if (fallback) setResults((prev) => (prev ? { ...prev, fallback } : prev));
      });
    }
  }

  function handleReset() {
    setView("input");
    setResults(null);
    setFallbackLoading(false);
  }

  // CTA is active when user has given us something to work with
  const hasInput =
    freeText.trim().length > 0 ||
    Object.values(chipSel).flat().length > 0 ||
    Object.values(customItems).flat().length > 0;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (view === "loading") {
    return (
      <View style={[st.container, { backgroundColor: C.background }]}>
        <View style={[st.loadingWrap, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={[st.loadingText, { color: C.textSecondary }]}>
            Working out what you can make…
          </Text>
        </View>
      </View>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  if (view === "results" && results) {
    const allEmpty =
      results.readyNow.length === 0 &&
      results.rescue.length === 0 &&
      results.almostThere.length === 0 &&
      !results.fallback;

    return (
      <View style={[st.container, { backgroundColor: C.background }]}>
        <View
          style={[
            st.header,
            { paddingTop: insets.top + 8, borderBottomColor: C.cardBorder, backgroundColor: C.background },
          ]}
        >
          <TouchableOpacity
            onPress={handleReset}
            style={st.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="chevron-left" size={18} color={TEAL} />
            <Text style={[st.backText, { color: TEAL }]}>Try different ingredients</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            st.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {allEmpty ? (
            <View style={[st.emptyCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Feather name="search" size={26} color={C.textMuted} style={{ marginBottom: 12 }} />
              <Text style={[st.emptyTitle, { color: C.text }]}>Not much to go on</Text>
              <Text style={[st.emptySub, { color: C.textMuted }]}>
                Add a protein or a base — even just eggs and pasta opens a lot of doors.
              </Text>
              <TouchableOpacity
                style={[st.emptyRetryBtn, { backgroundColor: TEAL }]}
                onPress={handleReset}
                activeOpacity={0.82}
              >
                <Text style={st.emptyRetryText}>Add more ingredients</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* 1. Ready now — trustworthy exact matches */}
              {results.readyNow.length > 0 && (
                <>
                  <ResultSection label="Ready now" dotColor={TEAL} />
                  {results.readyNow.map((r) => <RecipeCard key={r.recipeId} result={r} />)}
                </>
              )}

              {/* 2. Sortii rescue options — pattern-based improvised meals */}
              {results.rescue.length > 0 && (
                <>
                  <ResultSection
                    label="Sortii rescue options"
                    dotColor={PLUM}
                    spaceTop={results.readyNow.length > 0}
                  />
                  {results.rescue.map((r) => <RescueCard key={r.id} idea={r} />)}
                </>
              )}

              {/* AI fallback spinner / card */}
              {fallbackLoading && (
                <View style={st.fallbackLoadRow}>
                  <ActivityIndicator size="small" color={PLUM} />
                  <Text style={[st.fallbackLoadText, { color: C.textMuted }]}>
                    Getting a backup idea…
                  </Text>
                </View>
              )}
              {results.fallback && results.rescue.length === 0 && (
                <>
                  <ResultSection
                    label="Sortii rescue options"
                    dotColor={PLUM}
                    spaceTop={results.readyNow.length > 0}
                  />
                  <FallbackCard idea={results.fallback} />
                </>
              )}
              {results.fallback && results.rescue.length > 0 && (
                <FallbackCard idea={results.fallback} />
              )}

              {/* 3. Almost there — strict, 1 supporting ingredient missing */}
              {results.almostThere.length > 0 && (
                <>
                  <ResultSection
                    label="Almost there"
                    dotColor={GOLD}
                    spaceTop={results.readyNow.length > 0 || results.rescue.length > 0}
                  />
                  {results.almostThere.map((r) => <RecipeCard key={r.recipeId} result={r} />)}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  return (
    <View style={[st.container, { backgroundColor: C.background }]}>
      <View
        style={[
          st.header,
          { paddingTop: insets.top + 8, borderBottomColor: C.cardBorder, backgroundColor: C.background },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={st.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={18} color={C.textSecondary} />
          <Text style={[st.backText, { color: C.textSecondary }]}>Meals</Text>
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: C.text }]}>
          Fridge Rescue
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            st.scrollContent,
            { paddingBottom: 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={[st.introCard, { backgroundColor: TEAL + "0D", borderColor: TEAL + "24" }]}>
            <Text style={[st.introText, { color: C.textSecondary }]}>
              Tell me what you've got and I'll work out what dinner could be. Oil, salt and pepper are assumed.
            </Text>
          </View>

          {/* ── PRIMARY: Free text input ── */}
          <View style={st.sectionBlock}>
            <Text style={[st.sectionLabel, { color: C.text }]}>
              Just tell me what you've got
            </Text>
            <TextInput
              style={[
                st.freeText,
                { color: C.text, borderColor: C.border, backgroundColor: C.chipBg },
              ]}
              placeholder={
                "e.g. eggs, wraps, cheese, frozen peas, half an onion… need something easy"
              }
              placeholderTextColor={C.textMuted}
              value={freeText}
              onChangeText={setFreeText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              returnKeyType="done"
              blurOnSubmit
            />
          </View>

          {/* Divider */}
          <View style={st.dividerRow}>
            <View style={[st.dividerLine, { backgroundColor: C.border }]} />
            <Text style={[st.dividerText, { color: C.textMuted }]}>
              Or tap through some prompts
            </Text>
            <View style={[st.dividerLine, { backgroundColor: C.border }]} />
          </View>

          {/* ── SECONDARY: Guided chip sections ── */}
          {SECTION_DEFS.map((section) => (
            <View key={section.id} style={st.sectionBlock}>
              <Text style={[st.sectionLabel, { color: C.text }]}>{section.label}</Text>

              <View style={st.chipWrap}>
                {section.chips.map((chip) => {
                  const active = chipSel[section.id].includes(chip);
                  return (
                    <TouchableOpacity
                      key={chip}
                      style={[
                        st.chip,
                        {
                          backgroundColor: active ? TEAL + "14" : C.chipBg,
                          borderColor: active ? TEAL : C.border,
                        },
                      ]}
                      onPress={() => toggleChip(section.id, chip)}
                      activeOpacity={0.72}
                    >
                      <Text style={[st.chipText, { color: active ? TEAL : C.textSecondary }]}>
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom additions */}
              {customItems[section.id].length > 0 && (
                <View style={st.chipWrap}>
                  {customItems[section.id].map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        st.chip,
                        { backgroundColor: TEAL + "14", borderColor: TEAL, flexDirection: "row", gap: 4 },
                      ]}
                      onPress={() => removeCustom(section.id, item)}
                      activeOpacity={0.72}
                    >
                      <Text style={[st.chipText, { color: TEAL }]}>{item}</Text>
                      <Feather name="x" size={10} color={TEAL} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[st.customRow, { borderColor: C.border, backgroundColor: C.chipBg }]}>
                <TextInput
                  style={[st.customInput, { color: C.text }]}
                  placeholder="Add your own…"
                  placeholderTextColor={C.textMuted}
                  value={customInputs[section.id]}
                  onChangeText={(t) =>
                    setCustomInputs((prev) => ({ ...prev, [section.id]: t }))
                  }
                  onSubmitEditing={() => commitCustom(section.id)}
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
                {customInputs[section.id].trim().length > 0 && (
                  <TouchableOpacity
                    onPress={() => commitCustom(section.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="plus" size={16} color={TEAL} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {/* Night style / preferences */}
          <View style={st.sectionBlock}>
            <Text style={[st.sectionLabel, { color: C.text }]}>What kind of night is this?</Text>
            <View style={st.chipWrap}>
              {PREF_DEFS.map(({ id, label }) => {
                const active = preferences.includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={[
                      st.chip,
                      {
                        backgroundColor: active ? GOLD + "14" : C.chipBg,
                        borderColor: active ? GOLD : C.border,
                      },
                    ]}
                    onPress={() => togglePref(id)}
                    activeOpacity={0.72}
                  >
                    <Text style={[st.chipText, { color: active ? GOLD : C.textSecondary }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View
          style={[
            st.ctaWrap,
            {
              paddingBottom: insets.bottom + 12,
              borderTopColor: C.cardBorder,
              backgroundColor: C.background,
            },
          ]}
        >
          <TouchableOpacity
            style={[st.ctaBtn, { backgroundColor: hasInput ? TEAL : C.chipBg }]}
            onPress={handleRun}
            activeOpacity={0.82}
          >
            <Text style={[st.ctaBtnText, { color: hasInput ? "#fff" : C.textMuted }]}>
              {hasInput ? "See what I can make →" : "Add some ingredients first"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
  },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  headerTitle: { fontSize: 20, fontFamily: "DMSans_700Bold", lineHeight: 26 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  introCard: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 14,
    marginBottom: 22,
  },
  introText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },

  // ── Input sections ──
  sectionBlock: { marginBottom: 22, gap: 10 },
  sectionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 19 },

  freeText: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 100,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  customRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 9 : 6,
    gap: 8,
  },
  customInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },

  // ── CTA ──
  ctaWrap: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  ctaBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  ctaBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: 0.1 },

  // ── Loading ──
  loadingWrap: { flex: 1, alignItems: "center", gap: 16 },
  loadingText: { fontSize: 15, fontFamily: "Inter_400Regular" },

  // ── Results: section headers ──
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // ── Cards ──
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12, gap: 6 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, marginBottom: 2 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  cardName: { fontSize: 16, fontFamily: "DMSans_700Bold", lineHeight: 22 },
  cardReason: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  missingNote: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },

  // ── Steps (rescue / fallback cards) ──
  stepRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  stepNum: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 16 },
  stepText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  // ── Fallback loader ──
  fallbackLoadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
    justifyContent: "center",
  },
  fallbackLoadText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  // ── Empty state ──
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    marginTop: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: "DMSans_700Bold", textAlign: "center" },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  emptyRetryBtn: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  emptyRetryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
