import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "@/constants/Colors";
import { Recipe, getPrepStyleLabel } from "@/constants/recipes";
import { getCurrentAustralianSeason, isRecipeSeasonal } from "@/utils/seasonUtils";

interface MealSlotCardProps {
  day: string;
  slot: "lunch" | "dinner";
  recipe: Recipe | null;
  onAdd: () => void;
  onRemove: () => void;
  onSwap: () => void;
  onViewRecipe?: () => void;
  seasonalMode?: boolean;
}

export function MealSlotCard({
  day,
  slot,
  recipe,
  onAdd,
  onRemove,
  onSwap,
  onViewRecipe,
  seasonalMode = false,
}: MealSlotCardProps) {
  const C = Colors.light;
  const currentSeason = seasonalMode ? getCurrentAustralianSeason() : null;
  const showSeasonalBadge = seasonalMode && recipe != null && currentSeason
    ? isRecipeSeasonal(recipe, currentSeason)
    : false;
  const slotLabel = slot === "lunch" ? "Lunch" : "Dinner";

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove();
  };

  if (!recipe) {
    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onAdd();
        }}
        activeOpacity={0.7}
        style={[styles.emptySlot, { borderColor: C.inputBorder }]}
      >
        <View style={[styles.addIconBox, { backgroundColor: C.chipBg }]}>
          <Feather name="plus" size={20} color={C.primary} />
        </View>
        <View style={styles.emptyText}>
          <Text style={[styles.slotLabel, { color: C.textMuted }]}>
            {slotLabel}
          </Text>
          <Text style={[styles.addLabel, { color: C.primary }]}>
            Add a meal
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const cookIcon =
    recipe.cookingStyle === "air-fryer"
      ? "wind"
      : recipe.cookingStyle === "one-pan"
        ? "layers"
        : "coffee";

  return (
    <View style={[styles.filledSlot, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
      <View style={styles.slotHeader}>
        <View style={[styles.slotBadge, { backgroundColor: slot === "lunch" ? "#FFF8E1" : C.chipBg }]}>
          <Text style={[styles.slotBadgeText, { color: slot === "lunch" ? C.accent : C.primary }]}>
            {slotLabel}
          </Text>
        </View>
        <View style={styles.slotActions}>
          {onViewRecipe && (
            <TouchableOpacity onPress={onViewRecipe} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="book-open" size={14} color={C.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onSwap} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="refresh-cw" size={14} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRemove} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color={C.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.recipeRow}>
        <View style={[styles.recipeIconBox, { backgroundColor: C.chipBg }]}>
          <Feather name={cookIcon as any} size={16} color={C.primary} />
        </View>
        <View style={styles.recipeInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.recipeName, { color: C.text }]} numberOfLines={1}>
              {recipe.name}
            </Text>
            {getPrepStyleLabel(recipe) && (
              <View style={[styles.prepBadge, { backgroundColor: C.chipBg }]}>
                <Text style={[styles.prepBadgeText, { color: C.primary }]}>
                  {getPrepStyleLabel(recipe)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.recipeMeta, { color: C.textMuted }]}>
              {recipe.cookTimeMinutes} min · {recipe.difficulty}
            </Text>
            {showSeasonalBadge && (
              <View style={[styles.seasonalBadge, { backgroundColor: "#E8F5E0" }]}>
                <Text style={[styles.seasonalBadgeText, { color: "#4A7C4E" }]}>🌿 Seasonal</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptySlot: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  addIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    flex: 1,
    gap: 2,
  },
  slotLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  filledSlot: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  slotHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  slotBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  slotActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recipeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  recipeInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  recipeName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 19,
    flexShrink: 1,
  },
  prepBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  prepBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  recipeMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "capitalize",
  },
  seasonalBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  seasonalBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
