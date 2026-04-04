import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SwapRule } from "@/constants/swapRules";
import { getSwapsForRecipe } from "@/utils/getSwapsForRecipe";

const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";
const PLUM_BORDER = "#D4BAC8";

const MAX_VISIBLE = 3;

interface Props {
  ingredientNames: string[];
}

export function SwapTips({ ingredientNames }: Props) {
  const swaps = getSwapsForRecipe(ingredientNames);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [openTipId, setOpenTipId] = useState<string | null>(null);

  if (swaps.length === 0 || dismissed) return null;

  const visible = swaps.slice(0, MAX_VISIBLE);
  const overflow = swaps.length - MAX_VISIBLE;

  // Collapsed — just the pill
  if (!expanded) {
    return (
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        activeOpacity={0.75}
        style={styles.pill}
      >
        <Text style={styles.pillEmoji}>💡</Text>
        <Text style={styles.pillText}>
          {swaps.length === 1
            ? "1 swap available"
            : `${swaps.length} swaps available`}
        </Text>
        <Feather name="chevron-down" size={12} color={PLUM} />
      </TouchableOpacity>
    );
  }

  // Expanded — full panel
  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.panelHeader}>
        <Text style={styles.panelEmoji}>💡</Text>
        <Text style={styles.panelTitle}>Save money on this meal</Text>
        <TouchableOpacity
          onPress={() => setExpanded(false)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.collapseBtn}
        >
          <Feather name="chevron-up" size={14} color={PLUM} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.dismissBtn}
        >
          <Feather name="x" size={14} color={PLUM} />
        </TouchableOpacity>
      </View>

      {/* Swap rows */}
      {visible.map((swap) => (
        <SwapRow
          key={swap.id}
          swap={swap}
          tipOpen={openTipId === swap.id}
          onToggleTip={() =>
            setOpenTipId((prev) => (prev === swap.id ? null : swap.id))
          }
        />
      ))}

      {overflow > 0 && (
        <Text style={styles.overflowText}>
          +{overflow} more swap{overflow > 1 ? "s" : ""} available
        </Text>
      )}
    </View>
  );
}

function SwapRow({
  swap,
  tipOpen,
  onToggleTip,
}: {
  swap: SwapRule;
  tipOpen: boolean;
  onToggleTip: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onToggleTip}
      activeOpacity={0.7}
      style={styles.swapRow}
    >
      <View style={styles.swapArrow}>
        <Feather name="arrow-right" size={12} color={PLUM} />
      </View>
      <View style={styles.swapInfo}>
        <Text style={styles.swapLabel} numberOfLines={1}>
          Swap to{" "}
          <Text style={styles.swapLabelBold}>{swap.swapLabel}</Text>
        </Text>
        {tipOpen && (
          <Text style={styles.swapTip}>{swap.tip}</Text>
        )}
      </View>
      <Text style={styles.swapSaving}>
        ~${swap.savingPerServeAUD.toFixed(2)}/serve
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Collapsed pill
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: PLUM_TINT,
    borderWidth: 1,
    borderColor: PLUM_BORDER,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    marginLeft: 2,
  },
  pillEmoji: { fontSize: 12 },
  pillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: PLUM,
  },

  // Expanded panel
  panel: {
    marginTop: 6,
    backgroundColor: PLUM_TINT,
    borderLeftWidth: 3,
    borderLeftColor: PLUM,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PLUM_BORDER,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  panelEmoji: { fontSize: 14 },
  panelTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: PLUM,
  },
  collapseBtn: { padding: 2 },
  dismissBtn: { padding: 2, marginLeft: 4 },

  // Swap row
  swapRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  swapArrow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PLUM + "20",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  swapInfo: { flex: 1, gap: 2 },
  swapLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: PLUM,
  },
  swapLabelBold: {
    fontFamily: "Inter_600SemiBold",
  },
  swapTip: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: PLUM,
    fontStyle: "italic",
    marginTop: 1,
  },
  swapSaving: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: PLUM,
    flexShrink: 0,
  },

  overflowText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: PLUM,
    marginTop: 2,
    paddingLeft: 28,
  },
});
