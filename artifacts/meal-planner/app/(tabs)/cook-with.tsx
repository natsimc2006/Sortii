import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
} from "@/utils/cookWithTypes";

const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";

type SectionId = "protein" | "base" | "veg" | "extras";

const SECTION_DEFS: { id: SectionId; label: string; chips: string[] }[] = [
  {
    id: "protein",
    label: "What protein do you have?",
    chips: ["chicken", "beef mince", "eggs", "tuna", "beans", "tofu", "bacon", "sausage"],
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

// ── Result card ──────────────────────────────────────────────────────────────
function RecipeCard({ result }: { result: RecipeMatchResult }) {
  const C = Colors.light;
  const isMakeNow = result.category === "make_now";

  return (
    <View
      style={[
        st.resultCard,
        {
          backgroundColor: C.card,
          borderColor: isMakeNow ? TEAL + "38" : GOLD + "38",
        },
      ]}
    >
      <View
        style={[
          st.badge,
          { backgroundColor: isMakeNow ? TEAL + "14" : GOLD + "14" },
        ]}
      >
        <Text style={[st.badgeText, { color: isMakeNow ? TEAL : GOLD }]}>
          {isMakeNow ? "Ready to cook" : "Very close"}
        </Text>
      </View>

      <Text style={[st.resultName, { color: C.text }]}>{result.recipeName}</Text>
      <Text style={[st.resultReason, { color: C.textSecondary }]}>{result.reason}</Text>

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

      {result.missingIngredients.length > 0 && (
        <Text style={[st.missingText, { color: GOLD }]}>
          Need:{" "}
          {result.missingIngredients
            .slice(0, 3)
            .map((m) => m.toLowerCase())
            .join(", ")}
        </Text>
      )}
    </View>
  );
}

// ── Fallback card ────────────────────────────────────────────────────────────
function FallbackCard({ idea }: { idea: FallbackMealIdea }) {
  const C = Colors.light;
  return (
    <View
      style={[st.resultCard, { backgroundColor: C.card, borderColor: PLUM + "30" }]}
    >
      <View style={[st.badge, { backgroundColor: PLUM + "12" }]}>
        <Text style={[st.badgeText, { color: PLUM }]}>Backup idea</Text>
      </View>
      <Text style={[st.resultName, { color: C.text }]}>{idea.title}</Text>
      <Text style={[st.resultReason, { color: C.textSecondary }]}>{idea.reason}</Text>
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

// ── Section header row ───────────────────────────────────────────────────────
function SectionHeader({
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
    <View style={[st.resultSectionHeader, spaceTop && { marginTop: 28 }]}>
      <View style={[st.resultDot, { backgroundColor: dotColor }]} />
      <Text style={[st.resultSectionLabel, { color: C.text }]}>{label}</Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function CookWithScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const C        = Colors.light;
  const scrollRef = useRef<ScrollView>(null);

  const [chipSel, setChipSel] = useState<Record<SectionId, string[]>>({
    protein: [], base: [], veg: [], extras: [],
  });
  const [customItems, setCustomItems] = useState<Record<SectionId, string[]>>({
    protein: [], base: [], veg: [], extras: [],
  });
  const [customInputs, setCustomInputs] = useState<Record<SectionId, string>>({
    protein: "", base: "", veg: "", extras: "",
  });
  const [preferences, setPreferences] = useState<CookWithPreference[]>([]);
  const [freeText, setFreeText]         = useState("");
  const [view, setView]                 = useState<"input" | "loading" | "results">("input");
  const [results, setResults]           = useState<CookWithResults | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  function toggleChip(sid: SectionId, chip: string) {
    Keyboard.dismiss();
    setChipSel((prev) => {
      const cur     = prev[sid] || [];
      const already = cur.includes(chip);
      return {
        ...prev,
        [sid]: already ? cur.filter((c) => c !== chip) : [...cur, chip],
      };
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
    setCustomItems((prev) => ({
      ...prev,
      [sid]: [...(prev[sid] || []), text],
    }));
    setCustomInputs((prev) => ({ ...prev, [sid]: "" }));
  }

  function removeCustom(sid: SectionId, item: string) {
    setCustomItems((prev) => ({
      ...prev,
      [sid]: (prev[sid] || []).filter((i) => i !== item),
    }));
  }

  async function handleRun() {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setView("loading");

    const allSelected: string[] = [];
    for (const sid of Object.keys(chipSel) as SectionId[]) {
      chipSel[sid].forEach((c) => allSelected.push(c));
      customItems[sid].forEach((c) => allSelected.push(c));
    }

    const { ingredients: parsedIng, preferences: parsedPrefs } =
      parseIngredientText(freeText);

    const allIngredients = normalizeIngredients([...allSelected, ...parsedIng]);
    const allPrefs = [
      ...new Set([...preferences, ...parsedPrefs]),
    ] as CookWithPreference[];

    await new Promise((r) => setTimeout(r, 500));

    const local = scoreAndRankRecipes(allIngredients, allPrefs);
    setResults(local);
    setView("results");
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    const needsFallback = local.makeNow.length + local.veryClose.length < 2;
    if (needsFallback && allIngredients.length >= 1) {
      setFallbackLoading(true);
      generateFallbackMeal(allIngredients, allPrefs).then((fallback) => {
        setFallbackLoading(false);
        if (fallback) {
          setResults((prev) => (prev ? { ...prev, fallback } : prev));
        }
      });
    }
  }

  function handleReset() {
    setView("input");
    setResults(null);
    setFallbackLoading(false);
  }

  const totalSelected =
    Object.values(chipSel).flat().length +
    Object.values(customItems).flat().length +
    (freeText.trim() ? 1 : 0);

  // ── Loading ──
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

  // ── Results ──
  if (view === "results" && results) {
    const allEmpty =
      results.makeNow.length === 0 &&
      results.veryClose.length === 0 &&
      !results.fallback;

    return (
      <View style={[st.container, { backgroundColor: C.background }]}>
        <View
          style={[
            st.header,
            {
              paddingTop: insets.top + 8,
              borderBottomColor: C.cardBorder,
              backgroundColor: C.background,
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleReset}
            style={st.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="chevron-left" size={18} color={TEAL} />
            <Text style={[st.backBtnText, { color: TEAL }]}>
              Try different ingredients
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            st.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {allEmpty ? (
            <View
              style={[
                st.emptyCard,
                { backgroundColor: C.card, borderColor: C.cardBorder },
              ]}
            >
              <Feather
                name="search"
                size={26}
                color={C.textMuted}
                style={{ marginBottom: 12 }}
              />
              <Text style={[st.emptyTitle, { color: C.text }]}>
                Not much to go on
              </Text>
              <Text style={[st.emptySub, { color: C.textMuted }]}>
                Add a protein or a base — even just eggs and pasta opens a lot
                of doors.
              </Text>
              <TouchableOpacity
                style={[st.emptyRetry, { backgroundColor: TEAL }]}
                onPress={handleReset}
                activeOpacity={0.82}
              >
                <Text style={st.emptyRetryText}>Add more ingredients</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {results.makeNow.length > 0 && (
                <>
                  <SectionHeader
                    label="You can make this now"
                    dotColor={TEAL}
                  />
                  {results.makeNow.map((r) => (
                    <RecipeCard key={r.recipeId} result={r} />
                  ))}
                </>
              )}

              {results.veryClose.length > 0 && (
                <>
                  <SectionHeader
                    label="Very close"
                    dotColor={GOLD}
                    spaceTop={results.makeNow.length > 0}
                  />
                  {results.veryClose.map((r) => (
                    <RecipeCard key={r.recipeId} result={r} />
                  ))}
                </>
              )}

              {fallbackLoading && (
                <View style={st.fallbackLoadRow}>
                  <ActivityIndicator size="small" color={PLUM} />
                  <Text style={[st.fallbackLoadText, { color: C.textMuted }]}>
                    Getting a backup idea…
                  </Text>
                </View>
              )}

              {results.fallback && (
                <>
                  <SectionHeader
                    label="Or try this instead"
                    dotColor={PLUM}
                    spaceTop={
                      results.makeNow.length > 0 ||
                      results.veryClose.length > 0
                    }
                  />
                  <FallbackCard idea={results.fallback} />
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Input ──
  return (
    <View style={[st.container, { backgroundColor: C.background }]}>
      <View
        style={[
          st.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: C.cardBorder,
            backgroundColor: C.background,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={st.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={18} color={C.textSecondary} />
          <Text style={[st.backBtnText, { color: C.textSecondary }]}>Meals</Text>
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: C.text }]}>
          Cook With What's Already Here
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            st.scrollContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View
            style={[
              st.introCard,
              { backgroundColor: TEAL + "0D", borderColor: TEAL + "24" },
            ]}
          >
            <Text style={[st.introText, { color: C.textSecondary }]}>
              Tell me what you've got and I'll work out what dinner could be.
              I'll assume oil, salt and pepper are there.
            </Text>
          </View>

          {/* Guided sections */}
          {SECTION_DEFS.map((section) => (
            <View key={section.id} style={st.sectionBlock}>
              <Text style={[st.sectionLabel, { color: C.text }]}>
                {section.label}
              </Text>

              <View style={st.chipWrap}>
                {section.chips.map((chip) => {
                  const active = chipSel[section.id].includes(chip);
                  return (
                    <TouchableOpacity
                      key={chip}
                      style={[
                        st.chip,
                        {
                          backgroundColor: active
                            ? TEAL + "14"
                            : C.chipBg,
                          borderColor: active ? TEAL : C.border,
                        },
                      ]}
                      onPress={() => toggleChip(section.id, chip)}
                      activeOpacity={0.72}
                    >
                      <Text
                        style={[
                          st.chipText,
                          { color: active ? TEAL : C.textSecondary },
                        ]}
                      >
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom items added */}
              {customItems[section.id].length > 0 && (
                <View style={st.chipWrap}>
                  {customItems[section.id].map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        st.chip,
                        {
                          backgroundColor: TEAL + "14",
                          borderColor: TEAL,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        },
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

              {/* Custom input */}
              <View
                style={[
                  st.customRow,
                  { borderColor: C.border, backgroundColor: C.chipBg },
                ]}
              >
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

          {/* Night style */}
          <View style={st.sectionBlock}>
            <Text style={[st.sectionLabel, { color: C.text }]}>
              What kind of night is this?
            </Text>
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
                    <Text
                      style={[
                        st.chipText,
                        { color: active ? GOLD : C.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Free text */}
          <View style={st.sectionBlock}>
            <Text style={[st.sectionLabel, { color: C.textMuted }]}>
              Or just type what you've got
            </Text>
            <Pressable onPress={Keyboard.dismiss}>
              <TextInput
                style={[
                  st.freeText,
                  {
                    color: C.text,
                    borderColor: C.border,
                    backgroundColor: C.chipBg,
                  },
                ]}
                placeholder={
                  "e.g. chicken thighs, pasta, half an onion and a tin of tomatoes"
                }
                placeholderTextColor={C.textMuted}
                value={freeText}
                onChangeText={setFreeText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit
              />
            </Pressable>
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
            style={[
              st.ctaBtn,
              {
                backgroundColor:
                  totalSelected > 0 ? TEAL : C.chipBg,
              },
            ]}
            onPress={handleRun}
            activeOpacity={0.82}
          >
            <Text
              style={[
                st.ctaBtnText,
                { color: totalSelected > 0 ? "#fff" : C.textMuted },
              ]}
            >
              {totalSelected > 0
                ? "See what I can make →"
                : "Select some ingredients above"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1 },

  // Header
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
  backBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
    lineHeight: 26,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 0,
  },

  // Intro
  introCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 22,
  },
  introText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },

  // Section blocks
  sectionBlock: {
    marginBottom: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 19,
  },

  // Chips
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },

  // Custom input
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 9 : 6,
    gap: 8,
  },
  customInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },

  // Free text
  freeText: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    minHeight: 84,
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },

  // Results
  resultSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  resultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resultSectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  resultName: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    lineHeight: 22,
  },
  resultReason: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  missingText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },

  // Fallback steps
  stepRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  stepNum: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 16,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },

  fallbackLoadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
    justifyContent: "center",
  },
  fallbackLoadText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },

  // Empty state
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    marginTop: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "DMSans_700Bold",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  emptyRetry: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyRetryText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
