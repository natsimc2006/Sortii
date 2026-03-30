import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { usePlanner, SavedPlan } from "@/context/PlannerContext";

export default function SavedPlansScreen() {
  const { savedPlans, loadPlan, deletePlan, savePlan } = usePlanner();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = Colors.light;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleLoad = (plan: SavedPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loadPlan(plan);
    router.navigate("/(tabs)/planner");
  };

  const handleDelete = (plan: SavedPlan) => {
    if (pendingDeleteId === plan.id) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      deletePlan(plan.id);
      setPendingDeleteId(null);
    } else {
      setPendingDeleteId(plan.id);
    }
  };

  const handleDuplicate = (plan: SavedPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadPlan(plan);
    savePlan(`Copy of ${plan.name}`);
    showToast("Plan duplicated");
  };

  const modeLabel = (mode: string) => {
    if (mode === "manual") return "Manual";
    if (mode === "mixed") return "Mixed";
    return "Auto";
  };

  const renderPlan = ({ item }: { item: SavedPlan }) => {
    const filledCount = item.meals.filter((m) => m.recipeId).length;
    return (
      <View style={[styles.planCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <View style={styles.planHeader}>
          <View style={styles.planTitleRow}>
            <Text style={[styles.planName, { color: C.text }]}>{item.name}</Text>
            <View style={[styles.modeBadge, { backgroundColor: C.chipBg }]}>
              <Text style={[styles.modeBadgeText, { color: C.primary }]}>
                {modeLabel(item.preferences.planningMode)}
              </Text>
            </View>
          </View>
          <Text style={[styles.planDate, { color: C.textMuted }]}>
            {item.createdAt}
          </Text>
        </View>

        <View style={styles.planStats}>
          <StatChip icon="calendar" label={`${filledCount} meals`} />
          <StatChip icon="users" label={`${item.preferences.householdSize} people`} />
          <StatChip icon="dollar-sign" label={item.estimatedCost} />
        </View>

        <View style={styles.planActions}>
          <TouchableOpacity
            onPress={() => handleLoad(item)}
            style={[styles.actionBtnPrimary, { backgroundColor: C.primary }]}
          >
            <Feather name="folder-open" size={14} color="#fff" />
            <Text style={styles.actionBtnPrimaryText}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDuplicate(item)}
            style={[styles.actionBtn, { backgroundColor: C.chipBg }]}
          >
            <Feather name="copy" size={14} color={C.primary} />
            <Text style={[styles.actionBtnText, { color: C.primary }]}>Duplicate</Text>
          </TouchableOpacity>
          {pendingDeleteId === item.id ? (
            <View style={styles.deletePending}>
              <TouchableOpacity
                onPress={() => setPendingDeleteId(null)}
                style={[styles.deleteCancelBtn, { borderColor: C.cardBorder }]}
              >
                <Text style={[styles.deleteCancelText, { color: C.textSecondary }]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={styles.deleteConfirmBtn}
              >
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={[styles.deleteBtn]}
            >
              <Feather name="trash-2" size={14} color={C.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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
        <Text style={[styles.screenTitle, { color: C.text }]}>Saved Plans</Text>
        <Text style={[styles.screenSub, { color: C.textSecondary }]}>
          {savedPlans.length} plan{savedPlans.length !== 1 ? "s" : ""} saved
        </Text>
      </View>

      {toast && (
        <View style={[styles.toast, { backgroundColor: Colors.light.primary }]}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <FlatList
        data={savedPlans}
        keyExtractor={(item) => item.id}
        renderItem={renderPlan}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconBox, { backgroundColor: C.chipBg }]}>
              <Feather name="bookmark" size={36} color={C.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: C.text }]}>
              No saved plans
            </Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              Create a weekly plan and save it to come back to it later.
            </Text>
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)/planner")}
              style={[styles.emptyBtn, { backgroundColor: C.primary }]}
            >
              <Text style={styles.emptyBtnText}>Go to Planner</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

function StatChip({ icon, label }: { icon: string; label: string }) {
  const C = Colors.light;
  return (
    <View style={[styles.statChip, { backgroundColor: C.chipBg }]}>
      <Feather name={icon as any} size={11} color={C.primary} />
      <Text style={[styles.statChipText, { color: C.chipText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
  list: {
    padding: 20,
    gap: 16,
  },
  planCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  planHeader: {
    gap: 4,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planName: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modeBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  planDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  planStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  planActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  deletePending: {
    flexDirection: "row",
    gap: 6,
  },
  deleteCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  deleteCancelText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  deleteConfirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#D32F2F",
    alignItems: "center",
  },
  deleteConfirmText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
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
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 14,
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
    maxWidth: 260,
    lineHeight: 21,
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
