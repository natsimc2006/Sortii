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
  formatMoney: (n: number) => string;
  onBack: () => void;
  onSeeEverything: () => void;
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

function buildItems(
  pressureItems: PressureItem[],
  apptsTodayTomorrow: Appointment[],
  tonightsDinner: string | null,
  formatMoney: (n: number) => string,
): Array<{ icon: string; text: string }> {
  const todayStr = getDateStr(0);
  const tomorrowStr = getDateStr(1);
  const urgent: Array<{ icon: string; text: string }> = [];

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

  // Priority 3 — always one handled item (anchor to something sorted)
  const handledText = tonightsDinner
    ? `Dinner tonight — ${tonightsDinner}. Sorted.`
    : "Dinner is planned this week. Sorted.";
  const handled = { icon: "✅", text: handledText };

  // Max 3 total, always ends on the handled item
  return [...urgent.slice(0, 2), handled];
}

// ─── Component ────────────────────────────────────────────────────

export default function OverwhelmModal({
  visible,
  pressureItems,
  apptsTodayTomorrow,
  tonightsDinner,
  formatMoney,
  onBack,
  onSeeEverything,
}: OverwhelmModalProps) {
  const items = useMemo(
    () => buildItems(pressureItems, apptsTodayTomorrow, tonightsDinner, formatMoney),
    [pressureItems, apptsTodayTomorrow, tonightsDinner, formatMoney],
  );

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  };

  const handleSeeEverything = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSeeEverything();
  };

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
            {items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemIcon}>{item.icon}</Text>
                <Text style={styles.itemText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Footer calm message */}
          <Text style={styles.waitText}>Everything else can wait.</Text>

          {/* Exit actions */}
          <View style={styles.exitLinks}>
            <TouchableOpacity onPress={handleBack} style={styles.backCta} activeOpacity={0.85}>
              <Text style={styles.backCtaText}>Back to home</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSeeEverything} activeOpacity={0.7}>
              <Text style={styles.seeEverythingLink}>See everything  →</Text>
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
    fontFamily: "Manrope_700Bold",
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
    fontFamily: "Manrope_700Bold",
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
