import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Animated,
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
import { toImageSource, useRecipeImage } from "@/hooks/useRecipeImage";
import {
  HouseholdProfile,
  getDietaryPills,
  getSwapBadge,
  DietaryPill,
} from "@/utils/householdProfile";

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
  mealType:    { text: "#2A8F88", bg: "#E6F3F0" },
  seasonal:    { text: "#5F7C50", bg: "#EAF3E2" },
  prep:        { text: "#5E3A4C", bg: "#F3E8EE" },
  kidFriendly: { text: "#2A8F88", bg: "#E6F3F0" },
};

interface MealSlotCardProps {
  day: string;
  slot: "lunch" | "dinner";
  recipe: Recipe | null;
  onAdd: () => void;
  onRemove: () => void;
  onSwitchMeal: () => void;
  onViewRecipe?: () => void;
  onHideRecipe?: () => void;
  onAutoFill?: () => void;
  seasonalMode?: boolean;
  kidFriendlyFilter?: boolean;
  householdProfile?: HouseholdProfile;
  onSwapBadgePress?: (need: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function MealSlotCard({
  day,
  slot,
  recipe,
  onAdd,
  onRemove,
  onSwitchMeal,
  onViewRecipe,
  onHideRecipe,
  onAutoFill,
  seasonalMode = false,
  kidFriendlyFilter = false,
  householdProfile,
  onSwapBadgePress,
  isFavorite = false,
  onToggleFavorite,
}: MealSlotCardProps) {
  const [imgError, setImgError] = useState(false);
  const { src: imgSrc } = useRecipeImage(recipe?.id ?? "", recipe?.name ?? "", recipe?.imageUrl);
  const imgOpacity = useRef(new Animated.Value(0)).current;

  const handleImageLoad = () => {
    Animated.timing(imgOpacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: false,
    }).start();
  };
  const currentSeason = seasonalMode ? getCurrentAustralianSeason() : null;
  const showSeasonalBadge =
    seasonalMode && recipe != null && currentSeason
      ? isRecipeSeasonal(recipe, currentSeason)
      : false;
  const showKidBadge = kidFriendlyFilter && recipe != null && (recipe.kidFriendlyScore ?? 0) === 2;
  const slotLabel = slot === "lunch" ? "LUNCH" : "DINNER";
  const dietaryPills: DietaryPill[] = householdProfile && recipe
    ? getDietaryPills(recipe, householdProfile)
    : [];
  const swapBadge = householdProfile && recipe && onSwapBadgePress
    ? getSwapBadge(recipe, householdProfile)
    : null;

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove();
  };

  if (!recipe) {
    return (
      <View style={[styles.emptySlot, { borderColor: C.inputBorder }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAdd();
          }}
          activeOpacity={0.7}
          style={styles.emptySlotLeft}
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
        {onAutoFill && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAutoFill();
            }}
            activeOpacity={0.75}
            style={[styles.autoFillBtn, { backgroundColor: C.primary }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="zap" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const CUISINE_BG: Record<string, string> = {
    italian:        "#FFF3E8",
    asian:          "#E8F3F0",
    mexican:        "#FEF5E4",
    mediterranean:  "#EAF0FB",
    indian:         "#FFF0E6",
    american:       "#F5EBE0",
    australian:     "#EAF3E2",
    "middle-eastern": "#F3F0E8",
    other:          "#F0F0F0",
  };

  const CUISINE_EMOJI: Record<string, string> = {
    italian:        "🍝",
    asian:          "🍜",
    mexican:        "🌮",
    mediterranean:  "🫙",
    indian:         "🍛",
    american:       "🍔",
    australian:     "🥩",
    "middle-eastern": "🧆",
    other:          "🍽️",
  };

  const cuisineKey = recipe.cuisineType ?? "other";
  const placeholderBg = CUISINE_BG[cuisineKey] ?? "#F0F0F0";
  const placeholderEmoji = CUISINE_EMOJI[cuisineKey] ?? "🍽️";

  const showImage = imgSrc !== null && !imgError;
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

          {/* Favourite — amber star */}
          {onToggleFavorite && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleFavorite();
              }}
              style={[
                styles.actionBtn,
                { backgroundColor: isFavorite ? "#FFF3CD" : "#F5F1EB" },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={14}
                color={isFavorite ? "#D29A22" : "#ABABAB"}
              />
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
        <View style={[styles.recipeIconBox, { backgroundColor: showImage ? ICON.recipe.bg : placeholderBg }]}>
          {showImage ? (
            <Animated.Image
              source={toImageSource(imgSrc)!}
              style={[styles.recipeThumbnail, { opacity: imgOpacity }]}
              resizeMode="cover"
              onError={() => setImgError(true)}
              onLoad={handleImageLoad}
            />
          ) : (
            <Text style={styles.placeholderEmoji}>{placeholderEmoji}</Text>
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
            {showKidBadge && (
              <View style={[styles.kidBadge, { backgroundColor: BADGE.kidFriendly.bg }]}>
                <Text style={[styles.kidBadgeText, { color: BADGE.kidFriendly.text }]}>
                  ✓ Kid-friendly
                </Text>
              </View>
            )}
            {showSeasonalBadge && (
              <View style={[styles.seasonalBadge, { backgroundColor: BADGE.seasonal.bg }]}>
                <Text style={[styles.seasonalBadgeText, { color: BADGE.seasonal.text }]}>
                  🌿 Seasonal
                </Text>
              </View>
            )}
            {dietaryPills.map((pill) => (
              <View key={pill.label} style={[styles.dietaryPill, { backgroundColor: pill.bg }]}>
                <Text style={[styles.dietaryPillText, { color: pill.color }]}>
                  {pill.emoji} {pill.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {onViewRecipe && (
          <Feather name="chevron-right" size={14} color={C.textMuted} style={styles.chevron} />
        )}
      </TouchableOpacity>

      {/* Switch meal pill */}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSwitchMeal();
        }}
        activeOpacity={0.75}
        style={styles.switchMealPill}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Feather name="refresh-cw" size={12} color="#5E3A4C" />
        <Text style={styles.switchMealText}>Switch meal</Text>
      </TouchableOpacity>

      {swapBadge && onSwapBadgePress && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSwapBadgePress(swapBadge.need);
          }}
          activeOpacity={0.75}
          style={[styles.swapBadgeRow, { backgroundColor: "#F3E8EE" }]}
        >
          <Text style={[styles.swapBadgeText, { color: "#5E3A4C" }]}>
            {swapBadge.label}
          </Text>
        </TouchableOpacity>
      )}
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
  emptySlotLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  autoFillBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
  placeholderEmoji: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
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
  kidBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kidBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  chevron: {
    flexShrink: 0,
    marginLeft: 2,
  },
  dietaryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dietaryPillText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  swapBadgeRow: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
  },
  swapBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
  switchMealPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#F3E8EE",
    borderWidth: 1,
    borderColor: "#E8D8E4",
  },
  switchMealText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#5E3A4C",
    letterSpacing: 0.1,
  },
});
