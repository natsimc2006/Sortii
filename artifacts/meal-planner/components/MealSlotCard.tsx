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
import { Recipe } from "@/constants/recipes";

interface MealSlotCardProps {
  day: string;
  slot: "lunch" | "dinner";
  recipe: Recipe | null;
  onAdd: () => void;
  onRemove: () => void;
  onSwap: () => void;
  onViewRecipe?: () => void;
}

export function MealSlotCard({
  day,
  slot,
  recipe,
  onAdd,
  onRemove,
  onSwap,
  onViewRecipe,
}: MealSlotCardProps) {
  const C = Colors.light;
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
          <Text style={[styles.recipeName, { color: C.text }]} numberOfLines={2}>
            {recipe.name}
          </Text>
          <Text style={[styles.recipeMeta, { color: C.textMuted }]}>
            {recipe.cookTimeMinutes} min · {recipe.difficulty}
          </Text>
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
  recipeName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 19,
  },
  recipeMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "capitalize",
  },
});
