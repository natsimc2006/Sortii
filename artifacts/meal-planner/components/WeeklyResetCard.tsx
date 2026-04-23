import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "@/constants/Colors";

const C = Colors.light;

interface WeeklyResetCardProps {
  hasMealsSetup: boolean;
  hasMoneySetup: boolean;
  onReuse: () => void;
  onTweak: () => void;
  onStartFresh: () => void;
}

export function WeeklyResetCard({
  hasMealsSetup,
  hasMoneySetup,
  onReuse,
  onTweak,
  onStartFresh,
}: WeeklyResetCardProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const bodyText =
    hasMealsSetup && hasMoneySetup
      ? "Reuse last week's setup, tweak it, or start fresh."
      : hasMealsSetup
      ? "Reuse your meal plan, tweak it, or start fresh."
      : "Reuse your budget setup, tweak it, or start fresh.";

  const handleReuse = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfirmed(true);
    onReuse();
    setTimeout(() => setDismissed(true), 2200);
  };

  const handleTweak = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTweak();
    setDismissed(true);
  };

  const handleFresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartFresh();
    setDismissed(true);
  };

  if (confirmed) {
    return (
      <View style={[styles.card, { borderColor: C.primary, backgroundColor: C.tealTint }]}>
        <View style={styles.confirmedRow}>
          <Feather name="check-circle" size={18} color={C.primary} />
          <Text style={[styles.confirmedText, { color: C.primary }]}>
            Done — your week's back on track.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: C.border }]}>
      <View style={styles.headerRow}>
        <View style={[styles.newWeekBadge, { backgroundColor: C.gold }]}>
          <Text style={styles.newWeekBadgeText}>NEW WEEK</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: C.text }]}>New week, same you?</Text>
        <Text style={[styles.subtitle, { color: C.textSecondary }]}>{bodyText}</Text>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          onPress={handleReuse}
          activeOpacity={0.8}
          style={[styles.btnPrimary, { backgroundColor: C.primary }]}
        >
          <Feather name="repeat" size={14} color="#fff" />
          <Text style={styles.btnPrimaryText}>Reuse last week</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTweak}
          activeOpacity={0.8}
          style={[styles.btnSecondary, { borderColor: C.primary, backgroundColor: C.tealTint }]}
        >
          <Feather name="edit-2" size={14} color={C.primary} />
          <Text style={[styles.btnSecondaryText, { color: C.primary }]}>Tweak this week</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleFresh} activeOpacity={0.7} style={styles.freshBtn}>
        <Text style={[styles.freshText, { color: C.textMuted }]}>Start fresh</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 20,
    gap: 14,
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: { boxShadow: "0px 2px 12px rgba(0,0,0,0.07)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  newWeekBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  newWeekBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  body: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  btnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  freshBtn: {
    alignItems: "center",
    paddingVertical: 2,
  },
  freshText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
  confirmedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  confirmedText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
