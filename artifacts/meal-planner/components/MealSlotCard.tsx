import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "@/constants/Colors";
import { Recipe, getPrepStyleLabel } from "@/constants/recipes";
import { getCurrentAustralianSeason, isRecipeSeasonal } from "@/utils/seasonUtils";
import { useRecipeImage } from "@/hooks/useRecipeImage";

const C = Colors.light;

// Per-icon colour tokens
const ICON = {
  recipe:   { icon: "#2A8F88", bg: "#E6F3F0" },
  autoSwap: { icon: "#D29A22", bg: "#F6E6BA" },
  swap:     { icon: "#5E3A4C", bg: "#F3E8EE" },
  hide:     { icon: "#5E3A4C", bg: "#F3E8EE" },
  remove:   { icon: "#B86557", bg: "#F7E9E8" },
};

// Per-badge colour tokens
const BADGE = {
  mealType:  { text: "#2A8F88", bg: "#E6F3F0" },
  seasonal:  { text: "#5F7C50", bg: "#EAF3E2" },
  prep:      { text: "#5E3A4C", bg: "#F3E8EE" },
};

interface MealSlotCardProps {
  day: string;
  slot: "lunch" | "dinner";
  recipe: Recipe | null;
  onAdd: () => void;
  onRemove: () => void;
  onSwap: () => void;
  onViewRecipe?: () => void;
  onAutoSwap?: () => void;
  onHideRecipe?: () => void;
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
  onAutoSwap,
  onHideRecipe,
  seasonalMode = false,
}: MealSlotCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = useRecipeImage(recipe?.id ?? "", recipe?.name ?? "", recipe?.imageUrl);
  const currentSeason = seasonalMode ? getCurrentAustralianSeason() : null;
  const showSeasonalBadge =
    seasonalMode && recipe != null && currentSeason
      ? isRecipeSeasonal(recipe, currentSeason)
      : false;
  const slotLabel = slot === "lunch" ? "LUNCH" : "DINNER";

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
          <Text style={[styles.slotLabelText, { color: C.textMuted }]}>
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

  const showImage = !!imageUrl && !imgError;
  const prepLabel = getPrepStyleLabel(recipe);

  return (
    <View style={[styles.filledSlot, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
      {/* Header: meal type badge + action icons */}
      <View style={styles.slotHeader}>
        <View style={[styles.slotBadge, { backgroundColor: BADGE.mealType.bg }]}>
          <Text style={[styles.slotBadgeText, { color: BADGE.mealType.text }]}>
            {slotLabel}
          </Text>
        </View>

        <View style={styles.slotActions}>
          {/* Open recipe */}
          {onViewRecipe && (
            <TouchableOpacity
              onPress={onViewRecipe}
              style={[styles.actionBtn, { backgroundColor: ICON.recipe.bg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="book-open" size={14} color={ICON.recipe.icon} />
            </TouchableOpacity>
          )}

          {/* Auto swap — gold: featured smart action */}
          {onAutoSwap && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAutoSwap();
              }}
              style={[styles.actionBtn, { backgroundColor: ICON.autoSwap.bg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="zap" size={13} color={ICON.autoSwap.icon} />
            </TouchableOpacity>
          )}

          {/* Swap/regenerate — plum */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSwap();
            }}
            style={[styles.actionBtn, { backgroundColor: ICON.swap.bg }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="refresh-cw" size={14} color={ICON.swap.icon} />
          </TouchableOpacity>

          {/* Hide — plum */}
          {onHideRecipe && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onHideRecipe();
              }}
              style={[styles.actionBtn, { backgroundColor: ICON.hide.bg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="eye-off" size={13} color={ICON.hide.icon} />
            </TouchableOpacity>
          )}

          {/* Remove — warm red */}
          <TouchableOpacity
            onPress={handleRemove}
            style={[styles.actionBtn, { backgroundColor: ICON.remove.bg }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={14} color={ICON.remove.icon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recipe body — tappable to open recipe */}
      <TouchableOpacity
        onPress={onViewRecipe}
        activeOpacity={onViewRecipe ? 0.6 : 1}
        disabled={!onViewRecipe}
        style={styles.recipeRow}
      >
        <View style={[styles.recipeIconBox, { backgroundColor: ICON.recipe.bg }]}>
          {showImage ? (
            <Image
              source={{ uri: imageUrl! }}
              style={styles.recipeThumbnail}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <Feather name={cookIcon as any} size={16} color={ICON.recipe.icon} />
          )}
        </View>

        <View style={styles.recipeInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.recipeName, { color: C.text }]} numberOfLines={1}>
              {recipe.name}
            </Text>
            {prepLabel && (
              <View style={[styles.prepBadge, { backgroundColor: BADGE.prep.bg }]}>
                <Text style={[styles.prepBadgeText, { color: BADGE.prep.text }]}>
                  {prepLabel}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.recipeMeta, { color: C.textMuted }]}>
              {recipe.cookTimeMinutes} min · {recipe.difficulty}
            </Text>
            {showSeasonalBadge && (
              <View style={[styles.seasonalBadge, { backgroundColor: BADGE.seasonal.bg }]}>
                <Text style={[styles.seasonalBadgeText, { color: BADGE.seasonal.text }]}>
                  🌿 Seasonal
                </Text>
              </View>
            )}
          </View>
        </View>

        {onViewRecipe && (
          <Feather name="chevron-right" size={14} color={C.textMuted} style={styles.chevron} />
        )}
      </TouchableOpacity>
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
  slotLabelText: {
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
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
    ...Platform.select({
      web: { boxShadow: "0px 2px 10px rgba(0,0,0,0.09)" },
      default: {
        shadowColor: "#1A1A1A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
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
    gap: 6,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recipeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  recipeThumbnail: {
    width: 52,
    height: 52,
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
  chevron: {
    flexShrink: 0,
    marginLeft: 2,
  },
});
