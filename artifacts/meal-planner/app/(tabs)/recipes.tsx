import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { Recipe, getApproxCostPerServe } from "@/constants/recipes";
import { useLocale } from "@/context/LocaleContext";
import { RecipeCard } from "@/components/RecipeCard";
import { PillButton } from "@/components/PillButton";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";

type FilterType = "all" | "budget" | "healthy" | "high-protein" | "one-pan" | "air-fryer" | "leftovers";
type CostFilter = "any" | "under5" | "under10";

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Budget", value: "budget" },
  { label: "Healthy", value: "healthy" },
  { label: "High Protein", value: "high-protein" },
  { label: "One-Pan", value: "one-pan" },
  { label: "Air Fryer", value: "air-fryer" },
  { label: "Leftovers", value: "leftovers" },
];

const COST_FILTERS_AU: { label: string; value: CostFilter; icon: string }[] = [
  { label: "Any price", value: "any", icon: "dollar-sign" },
  { label: "Under $5/serve", value: "under5", icon: "dollar-sign" },
  { label: "Under $10/serve", value: "under10", icon: "dollar-sign" },
];
const COST_FILTERS_UK: { label: string; value: CostFilter; icon: string }[] = [
  { label: "Any price", value: "any", icon: "dollar-sign" },
  { label: "Under £3/serve", value: "under5", icon: "dollar-sign" },
  { label: "Under £6/serve", value: "under10", icon: "dollar-sign" },
];

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const C = Colors.light;
  const { appRecipes, currencySymbol, locale } = useLocale();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [costFilter, setCostFilter] = useState<CostFilter>("any");
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  const costThresholds = locale === 'UK' ? { low: 3, high: 6 } : { low: 5, high: 10 };

  const filtered = useMemo(() => {
    return appRecipes.filter((r) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !(r.description || '').toLowerCase().includes(q) &&
          !r.ingredients.some((i) => i.name.toLowerCase().includes(q))
        )
          return false;
      }
      if (filter === "budget") return r.budgetTags.includes("budget");
      if (filter === "healthy" && !r.healthTags.includes("healthy")) return false;
      if (filter === "high-protein" && !r.healthTags.includes("high-protein")) return false;
      if (filter === "one-pan" && r.cookingStyle !== "one-pan") return false;
      if (filter === "air-fryer" && r.cookingStyle !== "air-fryer") return false;
      if (filter === "leftovers" && !r.leftoversFriendly) return false;

      const costPerServe = r.costPerServe ?? getApproxCostPerServe(r);
      if (costFilter === "under5" && costPerServe >= costThresholds.low) return false;
      if (costFilter === "under10" && costPerServe >= costThresholds.high) return false;

      return true;
    });
  }, [search, filter, costFilter, appRecipes]);

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
            borderBottomColor: C.cardBorder,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.screenTitle, { color: C.text }]}>Recipes</Text>
            <Text style={[styles.screenSub, { color: C.textSecondary }]}>
              {filtered.length} of {appRecipes.length} recipes
            </Text>
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: C.card, borderColor: C.inputBorder }]}>
          <Feather name="search" size={16} color={C.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search recipes or ingredients..."
            placeholderTextColor={C.textMuted}
            style={[styles.searchInput, { color: C.text }]}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <PillButton
                key={f.value}
                label={f.label}
                active={filter === f.value}
                onPress={() => setFilter(f.value)}
                small
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.costRow}>
          <View style={[styles.costIcon, { backgroundColor: C.chipBg }]}>
            <Feather name="dollar-sign" size={13} color={C.primary} />
          </View>
          <Text style={[styles.costLabel, { color: C.textSecondary }]}>Price:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.costFilters}>
              {(locale === 'UK' ? COST_FILTERS_UK : COST_FILTERS_AU).map((f) => (
                <PillButton
                  key={f.value}
                  label={f.label}
                  active={costFilter === f.value}
                  onPress={() => setCostFilter(f.value)}
                  small
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onPress={() => setDetailRecipe(item)} />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="search" size={40} color={C.textMuted} />
            <Text style={[styles.emptyTitle, { color: C.text }]}>No recipes found</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              Try different search terms or remove some filters
            </Text>
          </View>
        }
      />

      <RecipeDetailModal
        recipe={detailRecipe}
        onClose={() => setDetailRecipe(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  screenSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  filterScroll: {
    marginHorizontal: -20,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  costIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  costLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flexShrink: 0,
  },
  costFilters: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  list: {
    padding: 20,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 280,
  },
});
