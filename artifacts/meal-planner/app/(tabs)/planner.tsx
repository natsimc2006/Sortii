import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { DAYS, MealSlot, Recipe, WEEKEND_DAYS } from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";
import { MealSlotCard } from "@/components/MealSlotCard";
import { MealSearchModal } from "@/components/MealSearchModal";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";

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
  } = usePlanner();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS[0]);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>("dinner");
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  const openSearch = (day: string, slot: MealSlot) => {
    setSelectedDay(day);
    setSelectedSlot(slot);
    setModalVisible(true);
  };

  const getEntry = (day: string, slot: MealSlot) =>
    currentPlan.find((e) => e.day === day && e.slot === slot);

  const handleAutoGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Auto-generate week",
      "This will replace all current meals. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: () => {
            autoGeneratePlan();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleFill = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fillRemainingSlots();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Clear plan", "Remove all meals from this week?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearPlan },
    ]);
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    savePlan();
    Alert.alert("Saved", "Your plan has been saved.");
  };

  const filledCount = currentPlan.filter((m) => m.recipeId).length;
  const totalSlots = currentPlan.length;

  const budgeLabel =
    preferences.budgetLevel === "budget"
      ? "Budget"
      : preferences.budgetLevel === "standard"
        ? "Standard"
        : "Premium";
  const healthLabel =
    preferences.healthStyle === "standard"
      ? "Standard"
      : preferences.healthStyle === "healthy"
        ? "Healthy"
        : "High Protein";

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 },
        ]}
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
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 12,
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
          onPress={() => router.push("/(tabs)/shopping")}
          style={[styles.actionBtnPrimary, { backgroundColor: C.primary }]}
        >
          <Feather name="shopping-cart" size={16} color="#fff" />
          <Text style={styles.actionBtnPrimaryText}>Shopping list</Text>
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
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actionBtnPrimary: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
