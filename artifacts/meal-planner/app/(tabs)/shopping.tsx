import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import {
  RecipeIngredient,
  scaleQuantity,
} from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";

type Category = RecipeIngredient["category"];

const CATEGORY_LABELS: Record<Category, string> = {
  vegetables: "Vegetables",
  proteins: "Meat & Proteins",
  dairy: "Dairy & Eggs",
  pantry: "Pantry",
  herbs: "Herbs & Spices",
  frozen: "Frozen",
  grains: "Grains & Bread",
  fruit: "Fruit",
  condiments: "Sauces & Condiments",
};

const CATEGORY_ICONS: Record<Category, string> = {
  vegetables: "feather",
  proteins: "zap",
  dairy: "droplet",
  pantry: "box",
  herbs: "wind",
  frozen: "thermometer",
  grains: "align-left",
  fruit: "circle",
  condiments: "server",
};

const CATEGORY_COLORS: Record<Category, string> = {
  vegetables: "#43A047",
  proteins: "#E53935",
  dairy: "#039BE5",
  pantry: "#8D6E63",
  herbs: "#7CB342",
  frozen: "#1E88E5",
  grains: "#FB8C00",
  fruit: "#EC407A",
  condiments: "#8E24AA",
};

interface ShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  category: Category;
  usedInRecipes: string[];
}

export default function ShoppingScreen() {
  const { currentPlan, getRecipeById, preferences, estimatedCostBand } = usePlanner();
  const insets = useSafeAreaInsets();
  const C = Colors.light;
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copiedToast, setCopiedToast] = useState(false);

  const shoppingItems = useMemo(() => {
    const map = new Map<string, ShoppingItem>();
    for (const entry of currentPlan) {
      if (!entry.recipeId) continue;
      const recipe = getRecipeById(entry.recipeId);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        const scaled = scaleQuantity(
          ing.quantity,
          recipe.baseServings,
          preferences.householdSize
        );
        const key = `${ing.name.toLowerCase()}_${ing.unit}`;
        if (map.has(key)) {
          const existing = map.get(key)!;
          existing.quantity += scaled;
          if (!existing.usedInRecipes.includes(recipe.name)) {
            existing.usedInRecipes.push(recipe.name);
          }
        } else {
          map.set(key, {
            name: ing.name,
            quantity: scaled,
            unit: ing.unit,
            category: ing.category,
            usedInRecipes: [recipe.name],
          });
        }
      }
    }
    return Array.from(map.values());
  }, [currentPlan, getRecipeById, preferences.householdSize]);

  const byCategory = useMemo(() => {
    const groups: Partial<Record<Category, ShoppingItem[]>> = {};
    for (const item of shoppingItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category]!.push(item);
    }
    return groups;
  }, [shoppingItems]);

  const categories = Object.keys(byCategory) as Category[];
  const checkedCount = checked.size;
  const totalCount = shoppingItems.length;

  const toggleCheck = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
  };

  const itemKey = (item: ShoppingItem) =>
    `${item.name.toLowerCase()}_${item.unit}`;

  const formatQty = (qty: number, unit: string) => {
    const q = qty < 1 ? Math.round(qty * 10) / 10 : Math.round(qty);
    return `${q} ${unit}`;
  };

  const buildListText = () => {
    let text = `Weekly Shopping List — ${estimatedCostBand}\n\n`;
    for (const cat of categories) {
      text += `${CATEGORY_LABELS[cat]}\n`;
      for (const item of byCategory[cat] || []) {
        text += `  - ${item.name}: ${formatQty(item.quantity, item.unit)}\n`;
      }
      text += "\n";
    }
    return text;
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(buildListText());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: buildListText() });
    } catch (_) {}
  };

  if (shoppingItems.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: C.background,
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
          },
        ]}
      >
        <Text style={[styles.screenTitle, { color: C.text }]}>
          Shopping List
        </Text>
        <View style={styles.emptyInner}>
          <View style={[styles.emptyIconBox, { backgroundColor: C.chipBg }]}>
            <Feather name="shopping-cart" size={40} color={C.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: C.text }]}>
            No meals planned yet
          </Text>
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>
            Add some meals to your weekly planner and your shopping list will
            appear here, grouped by aisle.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {copiedToast && (
        <View style={[styles.toast, { backgroundColor: C.primary }]}>
          <Feather name="check" size={14} color="#fff" />
          <Text style={styles.toastText}>Copied to clipboard!</Text>
        </View>
      )}
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
            borderBottomColor: C.cardBorder,
          },
        ]}
      >
        <View>
          <Text style={[styles.screenTitle, { color: C.text }]}>
            Shopping List
          </Text>
          <Text style={[styles.screenSub, { color: C.textSecondary }]}>
            {checkedCount} of {totalCount} items · Est. {estimatedCostBand}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleCopy}
            style={[styles.iconBtn, { backgroundColor: C.chipBg }]}
          >
            <Feather name="copy" size={18} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.iconBtn, { backgroundColor: C.chipBg }]}
          >
            <Feather name="share-2" size={18} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {checkedCount > 0 && (
        <View style={[styles.progressRow, { backgroundColor: C.chipBg }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: C.primary,
                width: `${(checkedCount / totalCount) * 100}%` as any,
              },
            ]}
          />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 },
        ]}
      >
        {categories.map((cat) => (
          <View key={cat} style={styles.categorySection}>
            <View style={styles.catHeader}>
              <View
                style={[
                  styles.catIconBox,
                  { backgroundColor: CATEGORY_COLORS[cat] + "20" },
                ]}
              >
                <Feather
                  name={CATEGORY_ICONS[cat] as any}
                  size={14}
                  color={CATEGORY_COLORS[cat]}
                />
              </View>
              <Text style={[styles.catLabel, { color: C.text }]}>
                {CATEGORY_LABELS[cat]}
              </Text>
              <Text style={[styles.catCount, { color: C.textMuted }]}>
                {byCategory[cat]?.length}
              </Text>
            </View>

            {(byCategory[cat] || []).map((item) => {
              const key = itemKey(item);
              const isChecked = checked.has(key);
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => toggleCheck(key)}
                  activeOpacity={0.7}
                  style={[
                    styles.itemRow,
                    { backgroundColor: C.card, borderColor: C.cardBorder },
                    isChecked && styles.checkedRow,
                  ]}
                >
                  <View
                    style={[
                      styles.checkBox,
                      {
                        borderColor: isChecked
                          ? C.primary
                          : C.inputBorder,
                        backgroundColor: isChecked ? C.primary : "transparent",
                      },
                    ]}
                  >
                    {isChecked && (
                      <Feather name="check" size={12} color="#fff" />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[
                        styles.itemName,
                        { color: isChecked ? C.textMuted : C.text },
                        isChecked && styles.strikethrough,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.usedInRecipes.length > 1 && (
                      <Text style={[styles.itemHint, { color: C.textMuted }]}>
                        Used in {item.usedInRecipes.length} meals
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.itemQty,
                      { color: isChecked ? C.textMuted : C.primary },
                    ]}
                  >
                    {formatQty(item.quantity, item.unit)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View
          style={[styles.costBanner, { backgroundColor: C.chipBg }]}
        >
          <Feather name="dollar-sign" size={18} color={C.primary} />
          <View>
            <Text style={[styles.costTitle, { color: C.text }]}>
              Estimated weekly grocery spend
            </Text>
            <Text style={[styles.costAmount, { color: C.primary }]}>
              {estimatedCostBand}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
  },
  screenSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: {
    height: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  list: {
    padding: 20,
    gap: 20,
  },
  categorySection: {
    gap: 8,
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  catIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  catCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  checkedRow: {
    opacity: 0.6,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  itemHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  itemQty: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  costBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 16,
  },
  costTitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  costAmount: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 80,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 21,
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
    zIndex: 99,
  },
  toastText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
