import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { DAYS, MealSlot, PANTRY_STAPLES, Recipe, WEEKEND_DAYS } from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";
import { MealSlotCard } from "@/components/MealSlotCard";
import { MealSearchModal } from "@/components/MealSearchModal";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";

type ConfirmAction = "auto" | "clear" | null;

export default function PlannerScreen() {
  const {
    preferences,
    currentPlan,
    getRecipeById,
    setMealSlot,
    fillRemainingSlots,
    autoGeneratePlan,
    clearPlan,
    savePlan,
    estimatedCostBand,
    preferencesDirty,
    setPreferencesDirty,
  } = usePlanner();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS[0]);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>("dinner");
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [savedToast, setSavedToast] = useState(false);

  const openSearch = (day: string, slot: MealSlot) => {
    setSelectedDay(day);
    setSelectedSlot(slot);
    setModalVisible(true);
  };

  const getEntry = (day: string, slot: MealSlot) =>
    currentPlan.find((e) => e.day === day && e.slot === slot);

  const handleAutoGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmAction("auto");
  };

  const handleFill = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fillRemainingSlots();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmAction("clear");
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    savePlan();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleConfirm = () => {
    if (confirmAction === "auto") {
      autoGeneratePlan();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (confirmAction === "clear") {
      clearPlan();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setConfirmAction(null);
  };

  const filledCount = currentPlan.filter((m) => m.recipeId).length;
  const totalSlots = currentPlan.length;

  const budgeLabel =
    preferences.budgetLevel === "super-budget"
      ? "Super Budget"
      : preferences.budgetLevel === "budget"
        ? "Budget"
        : preferences.budgetLevel === "standard"
          ? "Standard"
          : "Premium";
  const healthLabel =
    preferences.healthStyle === "healthy"
      ? "Healthy"
      : preferences.healthStyle === "high-protein"
        ? "High Protein"
        : preferences.healthStyle === "low-carb"
          ? "Low Carb"
          : preferences.healthStyle === "family-friendly"
            ? "Family Friendly"
            : "Standard";

  const TAB_BAR_HEIGHT = Platform.OS === "web" ? 60 : 49;

  const sharedIngredients = useMemo(() => {
    if (!preferences.minimiseWaste) return [];
    const allRecipes = currentPlan
      .filter((e) => e.recipeId)
      .map((e) => getRecipeById(e.recipeId!))
      .filter(Boolean) as Recipe[];
    if (allRecipes.length < 2) return [];
    const ingredientCount: Record<string, number> = {};
    for (const r of allRecipes) {
      for (const ing of r.ingredients) {
        const key = ing.name.toLowerCase().trim();
        if (PANTRY_STAPLES.has(key)) continue;
        ingredientCount[key] = (ingredientCount[key] ?? 0) + 1;
      }
    }
    return Object.entries(ingredientCount)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [currentPlan, preferences.minimiseWaste, getRecipeById]);

  return (
    <View style={{ flex: 1, backgroundColor: C.background, marginBottom: TAB_BAR_HEIGHT + insets.bottom }}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
            backgroundColor: C.background,
            borderBottomColor: C.cardBorder,
          },
        ]}
      >
        <View>
          <Text style={[styles.screenTitle, { color: C.text }]}>Weekly Planner</Text>
          <View style={styles.filterChips}>
            <FilterChip label={`${preferences.householdSize} people`} icon="users" />
            <FilterChip label={budgeLabel} icon="dollar-sign" />
            <FilterChip label={healthLabel} icon="activity" />
            <FilterChip label={estimatedCostBand} icon="shopping-bag" />
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/preferences")}
          style={[styles.settingsBtn, { backgroundColor: C.chipBg }]}
        >
          <Feather name="sliders" size={18} color={C.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content]}
      >
        <View style={[styles.progressBar, { backgroundColor: C.chipBg }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: C.primary,
                width: `${(filledCount / Math.max(totalSlots, 1)) * 100}%` as any,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: C.textSecondary }]}>
          {filledCount} of {totalSlots} meal slots filled
        </Text>

        {DAYS.map((day) => {
          const dinnerEntry = getEntry(day, "dinner");
          const lunchEntry =
            preferences.mealCoverage === "lunch-dinner"
              ? getEntry(day, "lunch")
              : null;

          const dinnerRecipe = dinnerEntry?.recipeId
            ? getRecipeById(dinnerEntry.recipeId) ?? null
            : null;
          const lunchRecipe = lunchEntry?.recipeId
            ? getRecipeById(lunchEntry.recipeId) ?? null
            : null;

          const isWeekend = WEEKEND_DAYS.includes(day);
          const hasWeekendOverride =
            isWeekend && preferences.weekendOverrides?.enabled;

          return (
            <View key={day} style={styles.dayBlock}>
              <View style={styles.dayLabelRow}>
                <Text style={[styles.dayLabel, { color: C.textSecondary }]}>
                  {day}
                </Text>
                {hasWeekendOverride && (
                  <View style={[styles.weekendBadge, { backgroundColor: C.accent + "18" }]}>
                    <Text style={[styles.weekendBadgeText, { color: C.accent }]}>
                      weekend
                    </Text>
                  </View>
                )}
              </View>
              {lunchEntry !== undefined && lunchEntry !== null && (
                <MealSlotCard
                  day={day}
                  slot="lunch"
                  recipe={lunchRecipe}
                  onAdd={() => openSearch(day, "lunch")}
                  onRemove={() => setMealSlot(day, "lunch", null)}
                  onSwap={() => openSearch(day, "lunch")}
                  onViewRecipe={lunchRecipe ? () => setDetailRecipe(lunchRecipe) : undefined}
                />
              )}
              <MealSlotCard
                day={day}
                slot="dinner"
                recipe={dinnerRecipe}
                onAdd={() => openSearch(day, "dinner")}
                onRemove={() => setMealSlot(day, "dinner", null)}
                onSwap={() => openSearch(day, "dinner")}
                onViewRecipe={dinnerRecipe ? () => setDetailRecipe(dinnerRecipe) : undefined}
              />
            </View>
          );
        })}

        {sharedIngredients.length > 0 && (
          <View style={[styles.sharedPanel, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <View style={styles.sharedPanelHeader}>
              <Text style={styles.sharedPanelIcon}>♻️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sharedPanelTitle, { color: C.text }]}>Shared ingredients this week</Text>
                <Text style={[styles.sharedPanelSub, { color: C.textMuted }]}>
                  These items appear in multiple meals — buy once, use often
                </Text>
              </View>
            </View>
            <View style={styles.sharedChipRow}>
              {sharedIngredients.map(({ name, count }) => (
                <View key={name} style={[styles.sharedChip, { backgroundColor: C.chipBg }]}>
                  <Text style={[styles.sharedChipText, { color: C.primary }]}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </Text>
                  <View style={[styles.sharedChipBadge, { backgroundColor: C.primary }]}>
                    <Text style={styles.sharedChipBadgeText}>×{count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {confirmAction && (
        <View
          style={[
            styles.confirmBar,
            { backgroundColor: C.accent + "14", borderTopColor: C.accent + "40" },
          ]}
        >
          <Text style={[styles.confirmText, { color: C.text }]}>
            {confirmAction === "auto"
              ? "Replace all meals with a new auto-generated week?"
              : "Clear all meals from this week?"}
          </Text>
          <View style={styles.confirmBtns}>
            <TouchableOpacity
              onPress={() => setConfirmAction(null)}
              style={[styles.confirmCancel, { borderColor: C.cardBorder }]}
            >
              <Text style={[styles.confirmCancelText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[
                styles.confirmOk,
                {
                  backgroundColor:
                    confirmAction === "clear" ? "#D32F2F" : C.primary,
                },
              ]}
            >
              <Text style={styles.confirmOkText}>
                {confirmAction === "auto" ? "Generate" : "Clear"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {savedToast && (
        <View
          style={[
            styles.toast,
            { backgroundColor: C.primary },
          ]}
        >
          <Feather name="check-circle" size={15} color="#fff" />
          <Text style={styles.toastText}>Plan saved!</Text>
        </View>
      )}

      {preferencesDirty && (
        <View style={[styles.prefsDirtyBar, { backgroundColor: "#FFF3E0", borderTopColor: "#FFB300" + "60" }]}>
          <Feather name="alert-circle" size={14} color={C.accent} />
          <Text style={[styles.prefsDirtyText, { color: C.accent }]}>
            Preferences updated
          </Text>
          <TouchableOpacity
            onPress={() => { autoGeneratePlan(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
            style={[styles.prefsDirtyBtn, { backgroundColor: C.accent }]}
          >
            <Text style={styles.prefsDirtyBtnText}>Regenerate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPreferencesDirty(false)}>
            <Feather name="x" size={16} color={C.accent} />
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: 10,
            backgroundColor: C.background,
            borderTopColor: C.cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleFill}
          style={[styles.actionBtn, { backgroundColor: C.chipBg }]}
        >
          <Feather name="zap" size={16} color={C.primary} />
          <Text style={[styles.actionBtnText, { color: C.primary }]}>Fill gaps</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAutoGenerate}
          style={[styles.actionBtn, { backgroundColor: C.chipBg }]}
        >
          <Feather name="refresh-cw" size={16} color={C.primary} />
          <Text style={[styles.actionBtnText, { color: C.primary }]}>Auto plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.actionBtn, { backgroundColor: C.chipBg }]}
        >
          <Feather name="bookmark" size={16} color={C.primary} />
          <Text style={[styles.actionBtnText, { color: C.primary }]}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleClear}
          style={[styles.actionBtn, { backgroundColor: "#FFF3E0" }]}
        >
          <Feather name="trash-2" size={16} color={C.accent} />
          <Text style={[styles.actionBtnText, { color: C.accent }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      <MealSearchModal
        visible={modalVisible}
        day={selectedDay}
        slot={selectedSlot}
        onClose={() => setModalVisible(false)}
      />

      <RecipeDetailModal
        recipe={detailRecipe}
        onClose={() => setDetailRecipe(null)}
      />
    </View>
  );
}

function FilterChip({ label, icon }: { label: string; icon: string }) {
  const C = Colors.light;
  return (
    <View style={[styles.filterChip, { backgroundColor: C.chipBg }]}>
      <Feather name={icon as any} size={10} color={C.primary} />
      <Text style={[styles.filterChipText, { color: C.chipText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  content: {
    padding: 20,
    gap: 4,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  dayBlock: {
    gap: 8,
    marginBottom: 20,
  },
  dayLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  weekendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  weekendBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  confirmBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  confirmText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  confirmBtns: {
    flexDirection: "row",
    gap: 8,
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  confirmOk: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmOkText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  toast: {
    position: "absolute",
    top: Platform.OS === "web" ? 80 : 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  toastText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  prefsDirtyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  prefsDirtyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  prefsDirtyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  prefsDirtyBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  actionBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  sharedPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sharedPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sharedPanelIcon: {
    fontSize: 20,
    marginTop: 1,
  },
  sharedPanelTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  sharedPanelSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  sharedChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sharedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 5,
    borderRadius: 20,
  },
  sharedChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  sharedChipBadge: {
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sharedChipBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
