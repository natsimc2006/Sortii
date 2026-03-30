import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { RECIPES, Recipe } from "@/constants/recipes";
import { RecipeCard } from "@/components/RecipeCard";
import { PillButton } from "@/components/PillButton";

type FilterType = "all" | "budget" | "healthy" | "high-protein" | "one-pan" | "air-fryer" | "leftovers";

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Budget", value: "budget" },
  { label: "Healthy", value: "healthy" },
  { label: "High Protein", value: "high-protein" },
  { label: "One-Pan", value: "one-pan" },
  { label: "Air Fryer", value: "air-fryer" },
  { label: "Leftovers", value: "leftovers" },
];

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const C = Colors.light;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  const filtered = useMemo(() => {
    return RECIPES.filter((r) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !r.description.toLowerCase().includes(q) &&
          !r.ingredients.some((i) => i.name.toLowerCase().includes(q))
        )
          return false;
      }
      if (filter === "budget") return r.budgetTags.includes("budget");
      if (filter === "healthy") return r.healthTags.includes("healthy");
      if (filter === "high-protein") return r.healthTags.includes("high-protein");
      if (filter === "one-pan") return r.cookingStyle === "one-pan";
      if (filter === "air-fryer") return r.cookingStyle === "air-fryer";
      if (filter === "leftovers") return r.leftoversFriendly;
      return true;
    });
  }, [search, filter]);

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
        <Text style={[styles.screenTitle, { color: C.text }]}>Recipes</Text>
        <Text style={[styles.screenSub, { color: C.textSecondary }]}>
          {RECIPES.length} Australian-friendly recipes
        </Text>

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
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>Try different search terms</Text>
          </View>
        }
      />

      {detailRecipe && (
        <RecipeDetailModal
          recipe={detailRecipe}
          onClose={() => setDetailRecipe(null)}
        />
      )}
    </View>
  );
}

function RecipeDetailModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const C = Colors.light;
  const insets = useSafeAreaInsets();

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: C.background }]}>
        <View
          style={[
            styles.modalHeader,
            {
              paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
              borderBottomColor: C.cardBorder,
            },
          ]}
        >
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalTitle, { color: C.text }]} numberOfLines={2}>
              {recipe.name}
            </Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: C.cardBorder }]}>
              <Feather name="x" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalDesc, { color: C.textSecondary }]}>
            {recipe.description}
          </Text>
          <View style={styles.modalMeta}>
            <MetaBadge icon="clock" label={`${recipe.cookTimeMinutes} min`} />
            <MetaBadge icon="users" label={`Serves ${recipe.baseServings}`} />
            <MetaBadge icon="bar-chart-2" label={recipe.difficulty} />
            <MetaBadge icon="layers" label={recipe.cookingStyle} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.modalBody,
            { paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 },
          ]}
        >
          <Text style={[styles.modalSectionTitle, { color: C.text }]}>Ingredients</Text>
          <Text style={[styles.servingNote, { color: C.textMuted }]}>
            Base: {recipe.baseServings} servings
          </Text>
          {recipe.ingredients.map((ing, i) => (
            <View key={i} style={[styles.ingRow, { borderBottomColor: C.cardBorder }]}>
              <View style={[styles.ingDot, { backgroundColor: C.chipBg }]} />
              <Text style={[styles.ingName, { color: C.text }]}>{ing.name}</Text>
              <Text style={[styles.ingQty, { color: C.primary }]}>
                {ing.quantity} {ing.unit}
              </Text>
            </View>
          ))}

          <Text style={[styles.modalSectionTitle, { color: C.text, marginTop: 24 }]}>
            Method
          </Text>
          {recipe.instructions.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: C.primary }]}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: C.textSecondary }]}>{step}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
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

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  screenSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
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
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  modalTitle: {
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
  },
  modalDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  modalMeta: {
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
  modalBody: {
    padding: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  servingNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  ingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  ingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ingName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  ingQty: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
});
