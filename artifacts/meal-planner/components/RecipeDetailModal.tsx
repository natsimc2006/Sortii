import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { Recipe, getApproxCostPerServe } from "@/constants/recipes";

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  onClose: () => void;
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

export function RecipeDetailModal({ recipe, onClose }: RecipeDetailModalProps) {
  const C = Colors.light;
  const insets = useSafeAreaInsets();

  if (!recipe) return null;

  const costPerServe = getApproxCostPerServe(recipe);

  return (
    <Modal
      visible={!!recipe}
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
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: C.text }]} numberOfLines={2}>
              {recipe.name}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: C.chipBg }]}
            >
              <Feather name="x" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.desc, { color: C.textSecondary }]}>
            {recipe.description}
          </Text>

          <View style={styles.metaRow}>
            <MetaBadge icon="clock" label={`${recipe.cookTimeMinutes} min`} />
            <MetaBadge icon="users" label={`Serves ${recipe.baseServings}`} />
            <MetaBadge icon="bar-chart-2" label={recipe.difficulty} />
            <MetaBadge icon="layers" label={recipe.cookingStyle} />
            <MetaBadge icon="dollar-sign" label={`~$${costPerServe.toFixed(2)}/serve`} />
            {recipe.leftoversFriendly && (
              <MetaBadge icon="refresh-cw" label="Leftovers" />
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.body,
            {
              paddingBottom:
                Platform.OS === "web" ? 60 : insets.bottom + 40,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { color: C.text }]}>
            Ingredients
          </Text>
          <Text style={[styles.servingNote, { color: C.textMuted }]}>
            Base quantities for {recipe.baseServings} servings
          </Text>

          {recipe.ingredients.map((ing, i) => (
            <View
              key={i}
              style={[styles.ingRow, { borderBottomColor: C.cardBorder }]}
            >
              <View style={[styles.ingDot, { backgroundColor: C.primary }]} />
              <Text style={[styles.ingName, { color: C.text }]}>
                {ing.name}
              </Text>
              <Text style={[styles.ingQty, { color: C.primary }]}>
                {ing.quantity} {ing.unit}
              </Text>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: C.text, marginTop: 28 }]}>
            Step-by-step method
          </Text>

          {recipe.instructions.map((step, i) => (
            <View key={i} style={[styles.stepCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <View style={[styles.stepNum, { backgroundColor: C.primary }]}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: C.text }]}>{step}</Text>
            </View>
          ))}

          <View style={[styles.tipBox, { backgroundColor: C.chipBg }]}>
            <Feather name="info" size={14} color={C.primary} />
            <Text style={[styles.tipText, { color: C.chipText }]}>
              Ingredient quantities shown are for the base recipe. The app scales
              them automatically for your household size on the shopping list.
            </Text>
          </View>
        </ScrollView>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
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
    flexShrink: 0,
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  metaRow: {
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
  body: {
    padding: 20,
    gap: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
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
    width: 7,
    height: 7,
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
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    marginTop: 6,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
});
