import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Appointment } from "@/utils/appointmentStore";

const TEAL = "#2A8F88";

// ─── Shared type (mirrors PressureItem in money.tsx) ─────────────
export interface PressureItem {
  name: string;
  amount: number;
  dateStr: string; // YYYY-MM-DD
}

export interface OverwhelmModalProps {
  visible: boolean;
  pressureItems: PressureItem[];
  apptsTodayTomorrow: Appointment[];
  tonightsDinner: string | null;
  dinnersPlanned: number;
  formatMoney: (n: number) => string;
  onBack: () => void;
  onSeeEverything: () => void;
  onDinnerPress?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getDateStr(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0]!;
}

function getDayLabel(dateStr: string): string {
  const todayStr = getDateStr(0);
  const tomorrowStr = getDateStr(1);
  if (dateStr === todayStr) return "today";
  if (dateStr === tomorrowStr) return "tomorrow";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date.toLocaleDateString("en-AU", { weekday: "long" });
}

interface FocusItem {
  icon: string;
  text: string;
  onPress?: () => void;
}

function buildItems(
  pressureItems: PressureItem[],
  apptsTodayTomorrow: Appointment[],
  tonightsDinner: string | null,
  dinnersPlanned: number,
  formatMoney: (n: number) => string,
  onDinnerPress?: () => void,
): FocusItem[] {
  const todayStr = getDateStr(0);
  const tomorrowStr = getDateStr(1);
  const urgent: FocusItem[] = [];

  // Priority 1 — bills/expenses due today or tomorrow (max 2 slots)
  const urgentBills = pressureItems.filter(
    (p) => p.dateStr === todayStr || p.dateStr === tomorrowStr,
  );
  for (const bill of urgentBills) {
    if (urgent.length >= 2) break;
    urgent.push({
      icon: "⚠️",
      text: `${bill.name} — ${formatMoney(bill.amount)} due ${getDayLabel(bill.dateStr)}`,
    });
  }

  // Priority 2 — appointments today or tomorrow (fill remaining urgent slots)
  if (urgent.length < 2) {
    for (const appt of apptsTodayTomorrow) {
      if (urgent.length >= 2) break;
      const dayLabel = getDayLabel(appt.date);
      const timeLabel = appt.startTime ? `, ${appt.startTime}` : "";
      urgent.push({
        icon: "📅",
        text: `${appt.title} — ${dayLabel}${timeLabel}`,
      });
    }
  }

  // Priority 3 — dinner state anchor
  let dinnerItem: FocusItem;
  if (tonightsDinner) {
    // Tonight's specific dinner is known — always show it as sorted
    dinnerItem = { icon: "✅", text: `Dinner tonight — ${tonightsDinner}. Sorted.` };
  } else if (dinnersPlanned === 0) {
    // Nothing planned — surface this clearly, make it tappable
    dinnerItem = {
      icon: "⬜",
      text: "Dinners aren't sorted yet.\nTakes about a minute. →",
      onPress: onDinnerPress,
    };
  } else if (dinnersPlanned <= 4) {
    const remaining = 7 - dinnersPlanned;
    dinnerItem = {
      icon: "🔲",
      text: `Dinners mostly sorted. ${remaining} night${remaining === 1 ? "" : "s"} still need something.`,
    };
  } else {
    // 5–7 dinners
    dinnerItem = { icon: "✅", text: "Dinner is sorted this week." };
  }

  // Max 3 total, always ends on the dinner anchor
  return [...urgent.slice(0, 2), dinnerItem];
}

// ─── Component ────────────────────────────────────────────────────

export default function OverwhelmModal({
  visible,
  pressureItems,
  apptsTodayTomorrow,
  tonightsDinner,
  dinnersPlanned,
  formatMoney,
  onBack,
  onSeeEverything,
  onDinnerPress,
}: OverwhelmModalProps) {
  const items = useMemo(
    () => buildItems(pressureItems, apptsTodayTomorrow, tonightsDinner, dinnersPlanned, formatMoney, onDinnerPress),
    [pressureItems, apptsTodayTomorrow, tonightsDinner, dinnersPlanned, formatMoney, onDinnerPress],
  );

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  };

  const handleSeeEverything = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSeeEverything();
  };

  // Footer calm/action text — "Start there." when dinner isn't sorted yet
  const footerText = dinnersPlanned === 0 && !tonightsDinner
    ? "Start there."
    : "Everything else can wait.";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>

          {/* Sortii logo mark */}
          <Text style={styles.logoText}>sortii</Text>

          {/* Focus mode eyebrow */}
          <Text style={styles.focusLabel}>FOCUS MODE</Text>

          {/* Main heading */}
          <Text style={styles.heading}>Right now, just{"\n"}focus on this.</Text>

          {/* The 3 items */}
          <View style={styles.itemsWrap}>
            {items.map((item, i) => {
              const row = (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                  <Text style={[styles.itemText, item.onPress && { color: TEAL }]}>{item.text}</Text>
                </View>
              );
              if (item.onPress) {
                return (
                  <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.onPress!(); }}>
                    {row}
                  </TouchableOpacity>
                );
              }
              return row;
            })}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Footer calm/start message */}
          <Text style={styles.waitText}>{footerText}</Text>

          {/* Exit actions */}
          <View style={styles.exitLinks}>
            <TouchableOpacity onPress={handleBack} style={styles.backCta} activeOpacity={0.85}>
              <Text style={styles.backCtaText}>Back to home →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSeeEverything} activeOpacity={0.7}>
              <Text style={styles.seeEverythingLink}>See the full week →</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 36,
    paddingBottom: 40,
    justifyContent: "center",
    gap: 20,
  },
  logoText: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: TEAL,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: -4,
  },
  focusLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: TEAL,
    textAlign: "center",
    letterSpacing: 1.8,
    marginBottom: -4,
  },
  heading: {
    fontSize: 24,
    fontFamily: "DMSans_700Bold",
    color: "#2B2B2B",
    textAlign: "center",
    lineHeight: 34,
  },
  itemsWrap: {
    gap: 18,
    marginTop: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  itemIcon: {
    fontSize: 20,
    lineHeight: 28,
    width: 28,
    textAlign: "center",
  },
  itemText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#2B2B2B",
    lineHeight: 26,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#E6E1D7",
  },
  waitText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#AAAAAA",
    textAlign: "center",
  },
  exitLinks: {
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
  },
  backCta: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
  },
  backCtaText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  seeEverythingLink: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#AAAAAA",
    letterSpacing: 0.2,
  },
});
