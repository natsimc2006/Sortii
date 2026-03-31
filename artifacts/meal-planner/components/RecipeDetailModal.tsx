import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { Recipe, getApproxCostPerServe, scaleQuantity } from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  onClose: () => void;
}

const STEP_TIPS: Array<{ keywords: string[]; tip: string }> = [
  {
    keywords: ["dice", "finely dice", "roughly dice"],
    tip: "Cut into small, even cubes — uniformly sized pieces cook at the same rate. For most vegetables, 1 cm cubes work well. Keep your non-knife hand in the 'claw' position for safety.",
  },
  {
    keywords: ["chop", "roughly chop", "finely chop"],
    tip: "Use a rocking motion with the tip of the knife staying on the board. For a fine chop, gather the pieces and repeat the rocking motion two or three times.",
  },
  {
    keywords: ["thinly slice", "slice"],
    tip: "Use a gentle sawing motion rather than pressing straight down. For meat, freezing for 20 minutes first makes thin slicing much easier and more even.",
  },
  {
    keywords: ["mince garlic", "minced garlic", "mince the garlic"],
    tip: "Smash the clove with the flat of your knife first — the skin slips straight off. Then rock the blade back and forth over the garlic until very fine.",
  },
  {
    keywords: ["grate", "grated"],
    tip: "A microplane or fine box grater gives the fluffiest texture and best flavour release. For ginger, the edge of a spoon is a great tool for peeling before grating.",
  },
  {
    keywords: ["sauté", "saute"],
    tip: "The pan should be properly hot before adding oil — a drop of water should sizzle and evaporate in under a second. Don't overcrowd the pan or food will steam rather than brown.",
  },
  {
    keywords: ["stir-fry", "stir fry"],
    tip: "High heat is essential. Have every ingredient prepped before you turn the burner on — things cook in under a minute at wok temperature. Toss constantly to prevent burning.",
  },
  {
    keywords: ["simmer"],
    tip: "A true simmer means small bubbles rising gently to the surface — not a rapid boil. Reduce heat until you see just occasional movement. This develops flavour without reducing the liquid too fast.",
  },
  {
    keywords: ["boil"],
    tip: "For pasta, use a large pot of generously salted water — it should taste like mild sea water. This is the only chance you have to season the pasta itself.",
  },
  {
    keywords: ["brown the"],
    tip: "Don't move the protein too soon — let it sit undisturbed until it releases naturally from the pan. This is the Maillard reaction building deep, savoury flavour. Resist the urge to stir.",
  },
  {
    keywords: ["sear"],
    tip: "Pat the protein completely dry with paper towel before searing — surface moisture causes steaming instead of browning. A very hot, lightly oiled pan gives the best crust.",
  },
  {
    keywords: ["heat oil", "add oil"],
    tip: "The oil is ready when a small piece of food dropped in sizzles immediately. Olive oil has a lower smoke point than vegetable or peanut oil, so watch the heat carefully.",
  },
  {
    keywords: ["season", "salt and pepper", "salt & pepper"],
    tip: "Season in layers throughout cooking, not just at the end. Taste as you go — a pinch of salt at each stage builds depth. A small squeeze of lemon can brighten a dish that tastes flat.",
  },
  {
    keywords: ["marinate", "marinade"],
    tip: "Acids (lemon juice, vinegar, yoghurt) tenderise protein but can make it mushy if left too long. 30 minutes to 2 hours is ideal for most cuts. Discard used marinade — don't cook with it.",
  },
  {
    keywords: ["rest", "set aside to rest"],
    tip: "Resting allows the muscle fibres to relax and reabsorb their juices. Cutting too early causes those juices to run straight out. Loosely tenting with foil keeps the meat warm while it rests.",
  },
  {
    keywords: ["deglaze"],
    tip: "Add liquid to a hot pan and immediately scrape the browned bits off the base — that's where concentrated flavour lives. Wine, stock, or even water all work well.",
  },
  {
    keywords: ["al dente"],
    tip: "Bite a piece of pasta — al dente means there is slight firmness or 'bite' in the very centre but no raw chalkiness. It will continue cooking slightly after draining, so pull it 1 minute early.",
  },
  {
    keywords: ["caramelise", "caramelize", "caramelised onion"],
    tip: "True caramelisation takes patience — 25 to 40 minutes on medium-low heat. Rushing it on high heat burns rather than caramelises. Stir occasionally and add a splash of water if the pan dries out.",
  },
  {
    keywords: ["golden", "golden brown"],
    tip: "Golden brown is where maximum flavour development has happened. Watch carefully — the few seconds between perfectly golden and burnt can sneak up on you, especially with garlic.",
  },
  {
    keywords: ["drain"],
    tip: "Reserve a cup of the pasta or vegetable cooking water before draining. The starchy or mineral-rich water is excellent for loosening and emulsifying sauces later.",
  },
  {
    keywords: ["whisk"],
    tip: "Use a circular or figure-eight motion and lift the whisk slightly to incorporate air. For emulsified sauces, whisk vigorously to keep oil and liquid combined.",
  },
  {
    keywords: ["garlic"],
    tip: "Garlic burns easily and turns bitter in under a minute. Add it after longer-cooking aromatics like onion, and keep the heat at medium. Burnt garlic usually means starting the base again.",
  },
  {
    keywords: ["onion"],
    tip: "Onion is ready for the next step when it turns translucent and the edges are just starting to colour. Stirring too frequently prevents browning that adds depth to the dish.",
  },
  {
    keywords: ["ginger"],
    tip: "A spoon works brilliantly for peeling fresh ginger — just scrape the skin off. Grate on a microplane for the finest texture and strongest flavour release into the dish.",
  },
  {
    keywords: ["fold"],
    tip: "Folding preserves air in a mixture — use a large spatula and cut down the centre then sweep up the sides in a 'J' motion. Stir as little as possible to keep the mixture light.",
  },
  {
    keywords: ["reduce"],
    tip: "Reducing concentrates flavour and thickens the sauce through evaporation. Keep the heat at medium — too high can scorch the base. Stir occasionally and watch the level.",
  },
  {
    keywords: ["coat", "toss to combine", "toss well"],
    tip: "Add sauces gradually and toss as you go — it's much easier to add more than to fix an overdressed or overly sauced dish. Serve immediately once dressed.",
  },
  {
    keywords: ["set aside", "keep warm"],
    tip: "Cover loosely with foil to retain heat. For extended holding, place in a low oven at 80°C — high enough to stay hot but low enough not to keep cooking.",
  },
];

function getStepDetail(step: string): string | null {
  const lower = step.toLowerCase();
  for (const entry of STEP_TIPS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.tip;
    }
  }
  return null;
}

function formatQty(qty: number): string {
  if (qty >= 100) return String(Math.round(qty));
  if (qty >= 10) return String(Math.round(qty * 2) / 2);
  if (qty === Math.floor(qty)) return String(qty);
  if (qty < 1) {
    const fractions: Record<number, string> = {
      0.25: "¼", 0.33: "⅓", 0.5: "½", 0.67: "⅔", 0.75: "¾",
    };
    const rounded = Math.round(qty * 4) / 4;
    return fractions[rounded] ?? qty.toFixed(1);
  }
  return String(Math.round(qty * 10) / 10);
}

function MetaBadge({ icon, label }: { icon: string; label: string }) {
  const C = Colors.light;
  return (
    <View style={[styles.metaBadge, { backgroundColor: C.chipBg }]}>
      <Feather name={icon as any} size={12} color={C.primary} />
      <Text style={[styles.metaBadgeText, { color: C.chipText }]}>{label}</Text>
    </View>
  );
}

export function RecipeDetailModal({ recipe, onClose }: RecipeDetailModalProps) {
  const C = Colors.light;
  const insets = useSafeAreaInsets();
  const { preferences } = usePlanner();
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  if (!recipe) return null;

  const householdSize = preferences.householdSize;
  const costPerServe = getApproxCostPerServe(recipe);
  const scaleFactor = householdSize !== recipe.baseServings;

  const toggleStep = (i: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <Modal
      visible={!!recipe}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
              borderBottomColor: C.cardBorder,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: C.text }]} numberOfLines={2}>
              {recipe.name}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: C.chipBg }]}
            >
              <Feather name="x" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.desc, { color: C.textSecondary }]}>
            {recipe.description}
          </Text>

          <View style={styles.metaRow}>
            <MetaBadge icon="clock" label={`${recipe.cookTimeMinutes} min`} />
            <MetaBadge icon="users" label={`Serves ${recipe.baseServings}`} />
            <MetaBadge icon="bar-chart-2" label={recipe.difficulty} />
            <MetaBadge icon="layers" label={recipe.cookingStyle} />
            <MetaBadge icon="dollar-sign" label={`~$${costPerServe.toFixed(2)}/serve`} />
            {recipe.leftoversFriendly && (
              <MetaBadge icon="refresh-cw" label="Leftovers" />
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>
              Ingredients
            </Text>
            <View style={[styles.servingPill, { backgroundColor: C.chipBg }]}>
              <Feather name="users" size={12} color={C.primary} />
              <Text style={[styles.servingPillText, { color: C.primary }]}>
                {scaleFactor
                  ? `Scaled for ${householdSize} people`
                  : `${recipe.baseServings} servings`}
              </Text>
            </View>
          </View>

          {recipe.ingredients.map((ing, i) => {
            const scaledQty = scaleFactor
              ? scaleQuantity(ing.quantity, recipe.baseServings, householdSize)
              : ing.quantity;
            return (
              <View
                key={i}
                style={[styles.ingRow, { borderBottomColor: C.cardBorder }]}
              >
                <View style={[styles.ingDot, { backgroundColor: C.primary }]} />
                <Text style={[styles.ingName, { color: C.text }]}>
                  {ing.name}
                  {ing.optional ? (
                    <Text style={{ color: C.textMuted }}> (optional)</Text>
                  ) : null}
                </Text>
                <Text style={[styles.ingQty, { color: C.primary }]}>
                  {formatQty(scaledQty)} {ing.unit}
                </Text>
              </View>
            );
          })}

          <View style={styles.stepsHeader}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>
              Step-by-step method
            </Text>
            <Text style={[styles.stepsHint, { color: C.textMuted }]}>
              Tap a step for detail
            </Text>
          </View>

          {recipe.instructions.map((step, i) => {
            const detail = getStepDetail(step);
            const isExpanded = expandedSteps.has(i);
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={detail ? 0.7 : 1}
                onPress={() => detail && toggleStep(i)}
                style={[
                  styles.stepCard,
                  {
                    backgroundColor: isExpanded ? C.primary + "0D" : C.card,
                    borderColor: isExpanded ? C.primary + "40" : C.cardBorder,
                  },
                ]}
              >
                <View style={[styles.stepNum, { backgroundColor: isExpanded ? C.primary : C.primary }]}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepText, { color: C.text }]}>{step}</Text>
                  {isExpanded && detail && (
                    <View style={[styles.stepDetail, { borderTopColor: C.primary + "30" }]}>
                      <Feather name="info" size={13} color={C.primary} style={{ marginTop: 1 }} />
                      <Text style={[styles.stepDetailText, { color: C.textSecondary }]}>
                        {detail}
                      </Text>
                    </View>
                  )}
                </View>
                {detail && (
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={isExpanded ? C.primary : C.textMuted}
                    style={styles.stepChevron}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  metaBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  body: {
    padding: 20,
    gap: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  servingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  servingPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  ingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  ingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  ingName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  ingQty: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  stepsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 4,
  },
  stepsHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    marginTop: 4,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  stepBody: {
    flex: 1,
    gap: 10,
  },
  stepText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  stepDetail: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  stepDetailText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  stepChevron: {
    marginTop: 4,
    flexShrink: 0,
  },
});
