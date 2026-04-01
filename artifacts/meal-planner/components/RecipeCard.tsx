import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "@/constants/Colors";
import { Recipe } from "@/constants/recipes";

interface RecipeCardProps {
  recipe: Recipe;
  onPress?: () => void;
  compact?: boolean;
  selected?: boolean;
}

export function RecipeCard({
  recipe,
  onPress,
  compact = false,
  selected = false,
}: RecipeCardProps) {
  const C = Colors.light;
  const [imgError, setImgError] = useState(false);

  const cookIcon =
    recipe.cookingStyle === "air-fryer"
      ? "wind"
      : recipe.cookingStyle === "one-pan"
        ? "layers"
        : "coffee";

  const showImage = !!recipe.imageUrl && !imgError;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.card,
        { backgroundColor: C.card, borderColor: selected ? C.primary : C.cardBorder },
        selected && styles.selectedCard,
        compact && styles.compactCard,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: C.chipBg }]}>
          {showImage ? (
            <Image
              source={{ uri: recipe.imageUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <Feather name={cookIcon as any} size={20} color={C.primary} />
          )}
        </View>
        <View style={styles.titleArea}>
          <Text
            style={[styles.name, { color: C.text }]}
            numberOfLines={compact ? 1 : 2}
          >
            {recipe.name}
          </Text>
          {!compact && (
            <Text
              style={[styles.description, { color: C.textSecondary }]}
              numberOfLines={2}
            >
              {recipe.description}
            </Text>
          )}
        </View>
        {selected && (
          <View style={[styles.checkBadge, { backgroundColor: C.primary }]}>
            <Feather name="check" size={14} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <MetaChip icon="clock" label={`${recipe.cookTimeMinutes} min`} />
        <MetaChip icon="users" label={`Serves ${recipe.baseServings}`} />
        <MetaChip icon="bar-chart-2" label={recipe.difficulty} />
        {recipe.leftoversFriendly && (
          <MetaChip icon="refresh-cw" label="Leftovers" accent />
        )}
      </View>
    </TouchableOpacity>
  );
}

function MetaChip({
  icon,
  label,
  accent = false,
}: {
  icon: string;
  label: string;
  accent?: boolean;
}) {
  const C = Colors.light;
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: accent ? C.accent + "18" : C.chipBg,
        },
      ]}
    >
      <Feather
        name={icon as any}
        size={11}
        color={accent ? C.accent : C.primary}
      />
      <Text
        style={[
          styles.chipText,
          { color: accent ? C.accent : C.chipText },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  selectedCard: {
    borderWidth: 2,
  },
  compactCard: {
    padding: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  thumbnail: {
    width: 48,
    height: 48,
  },
  titleArea: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
});
