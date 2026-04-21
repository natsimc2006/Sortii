import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { MealSlot, Recipe, filterRecipes } from "@/constants/recipes";
import { useLocale } from "@/context/LocaleContext";
import { usePlanner } from "@/context/PlannerContext";
import { RecipeCard } from "./RecipeCard";
import { loadFavorites } from "@/utils/favoritesStore";

interface MealSearchModalProps {
  visible: boolean;
  day: string;
  slot: MealSlot;
  onClose: () => void;
}

export function MealSearchModal({
  visible,
  day,
  slot,
  onClose,
}: MealSearchModalProps) {
  const { preferences, setMealSlot } = usePlanner();
  const { appRecipes } = useLocale();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showFavesOnly, setShowFavesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) loadFavorites().then(setFavoriteIds);
  }, [visible]);
  const C = Colors.light;

  const filteredRecipes = useMemo(() => {
    let base = showAll
      ? appRecipes
      : filterRecipes(preferences, slot, day, undefined, appRecipes);
    if (showFavesOnly && favoriteIds.length > 0) {
      base = base.filter((r) => favoriteIds.includes(r.id));
    }
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q))
    );
  }, [search, preferences, slot, showAll, appRecipes, showFavesOnly, favoriteIds]);

  const handleSelect = (recipe: Recipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMealSlot(day, slot, recipe.id);
    onClose();
    setSearch("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
              borderBottomColor: C.cardBorder,
            },
          ]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.headerTitle, { color: C.text }]}>
                Choose a Meal
              </Text>
              <Text style={[styles.headerSub, { color: C.textSecondary }]}>
                {day} · {slot === "lunch" ? "Lunch" : "Dinner"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: C.cardBorder }]}>
              <Feather name="x" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBox, { backgroundColor: C.card, borderColor: C.inputBorder }]}>
            <Feather name="search" size={16} color={C.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search meals or ingredients..."
              placeholderTextColor={C.textMuted}
              style={[styles.searchInput, { color: C.text }]}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              onPress={() => setShowAll(!showAll)}
              style={[
                styles.filterChip,
                { borderColor: showAll ? C.accent : C.primary, backgroundColor: showAll ? C.accent + "18" : C.primary + "12" },
              ]}
            >
              <Text style={[styles.filterChipText, { color: showAll ? C.accent : C.primary }]}>
                {showAll ? "All recipes" : "Filtered"}
              </Text>
            </TouchableOpacity>

            {favoriteIds.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowFavesOnly(!showFavesOnly)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: "#D29A22",
                    backgroundColor: showFavesOnly ? "#FFF3CD" : "transparent",
                    flexDirection: "row",
                    gap: 4,
                  },
                ]}
              >
                <Ionicons
                  name={showFavesOnly ? "star" : "star-outline"}
                  size={13}
                  color="#D29A22"
                />
                <Text style={[styles.filterChipText, { color: "#D29A22" }]}>
                  Favourites
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => handleSelect(item)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="search" size={40} color={C.textMuted} />
              <Text style={[styles.emptyTitle, { color: C.text }]}>
                No recipes found
              </Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                Try different search terms or show all recipes
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
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
    maxWidth: 260,
  },
});
