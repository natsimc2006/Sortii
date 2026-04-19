import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";
const PLUM_BORDER = "#D4BAC8";

interface Props {
  tips: string[];
}

export function PantryTips({ tips }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (tips.length === 0 || dismissed) return null;

  if (!expanded) {
    return (
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        activeOpacity={0.75}
        style={styles.pill}
      >
        <Text style={styles.pillEmoji}>🧄</Text>
        <Text style={styles.pillText}>
          {tips.length === 1 ? "One pantry tip worth knowing" : `${tips.length} pantry tips worth knowing`}
        </Text>
        <Feather name="chevron-down" size={12} color={PLUM} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelEmoji}>🧄</Text>
        <Text style={styles.panelTitle}>Pantry tips for this week</Text>
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

      {tips.map((tip, i) => (
        <View key={i} style={styles.tipRow}>
          <View style={styles.tipDot} />
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: 8,
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

  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: PLUM,
    marginTop: 6,
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: PLUM,
    lineHeight: 19,
  },
});
