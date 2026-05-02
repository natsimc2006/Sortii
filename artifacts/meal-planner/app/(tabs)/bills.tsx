import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { SavingsTipCard } from "@/components/SavingsTipCard";
import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Bill,
  BillType,
  EssentialLevel,
  RecurrenceType,
  advanceDueDate,
  computeBillStatus,
  loadBills,
  saveBills,
} from "@/utils/billStore";

// ── Colour tokens ──────────────────────────────────────────────────────────────
const TEAL      = "#2A8F88";
const GOLD      = "#D29A22";
const GOLD_TINT = "#F6E6BA";
const GOLD_TEXT = "#8A6010";
const PLUM      = "#5E3A4C";
const GREEN     = "#2A8F88";
const BG        = "#FFFFFF";
const CARD      = "#FFFFFF";
const BORDER    = "#E6E1D7";
const TEXT      = "#2B2B2B";
const MUTED     = "#888888";
const TEAL_TINT = "#E6F3F0";

// ── Category config ────────────────────────────────────────────────────────────
const BILL_CATEGORIES: { label: string; color: string }[] = [
  { label: "Home",          color: "#6B8F71" },
  { label: "Utilities",     color: "#4A8FA5" },
  { label: "School",        color: PLUM      },
  { label: "Kids",          color: GOLD      },
  { label: "Medical",       color: TEAL      },
  { label: "Car",           color: "#5A6B8F" },
  { label: "Insurance",     color: "#8F6B5A" },
  { label: "Subscriptions", color: "#C9748A" },
  { label: "Personal",      color: "#6B4C8F" },
  { label: "Other",         color: MUTED     },
];
function catColor(cat: string): string {
  return BILL_CATEGORIES.find((c) => c.label === cat)?.color ?? MUTED;
}

const RECURRENCE_TYPES: RecurrenceType[] = ["Weekly", "Fortnightly", "Monthly", "Quarterly", "Yearly"];
const ESSENTIAL_LEVELS: EssentialLevel[] = ["Essential", "Flexible", "Can Wait"];
const TAB_BAR_HEIGHT = Platform.OS === "web" ? 72 : 58;

// ── Status display ─────────────────────────────────────────────────────────────
function statusDisplay(bill: Bill): { label: string; color: string } {
  const s = computeBillStatus(bill);
  if (s === "Paid")      return { label: "Paid ✓",     color: GREEN };
  if (s === "Overdue")   return { label: "Overdue",    color: "#C04040" };
  if (s === "Due Soon")  return { label: "Due soon",   color: GOLD  };
  return { label: "Upcoming", color: TEAL };
}

// ── Date utilities ─────────────────────────────────────────────────────────────
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_FULL    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m! - 1), d!);
}
function shiftDateStr(s: string, days: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDateFull(s: string): string {
  const d = parseDate(s);
  return `${DAYS_FULL[d.getDay()]} ${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}
function formatDateShort(s: string): string {
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// ── Blank form ─────────────────────────────────────────────────────────────────
function blankForm(): Omit<Bill, "id" | "createdAt" | "updatedAt"> {
  return {
    title: "",
    category: "Home",
    amount: 0,
    dueDate: shiftDateStr(todayStr(), 7),
    billType: "oneOff",
    recurrenceType: "Monthly",
    assignedTo: "",
    notes: "",
    essentialLevel: "Essential",
    isPaid: false,
    paidDate: undefined,
  };
}

function uid(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Summary copy ───────────────────────────────────────────────────────────────
function pickSummaryCopy(bills: Bill[]): string {
  const overdue  = bills.filter((b) => computeBillStatus(b) === "Overdue").length;
  const dueSoon  = bills.filter((b) => computeBillStatus(b) === "Due Soon").length;
  if (overdue > 0)               return `${overdue} bill${overdue > 1 ? "s are" : " is"} giving side-eye.`;
  if (dueSoon > 0 && dueSoon < 3) return "A couple need your attention this week.";
  if (dueSoon >= 3)              return "A few bills are lining up. Worth a look.";
  if (bills.length === 0)        return "No bills here yet. Let's not celebrate too early.";
  return "Nothing too feral this week.";
}

// ── Components ─────────────────────────────────────────────────────────────────
function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[chipS.chip, { backgroundColor: color + "18" }]}>
      <Text style={[chipS.text, { color }]}>{label}</Text>
    </View>
  );
}
const chipS = StyleSheet.create({
  chip: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

function EssentialChip({ level }: { level: EssentialLevel }) {
  const cfg = {
    Essential:  { label: "Essential",        color: PLUM },
    Flexible:   { label: "Flexible",         color: GOLD },
    "Can Wait": { label: "Could be nudged",  color: MUTED },
  }[level] ?? { label: level, color: MUTED };
  return <StatusChip label={cfg.label} color={cfg.color} />;
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [calVisible, setCalVisible] = useState(false);
  const today    = todayStr();
  const nextWeek = shiftDateStr(today, 7);
  const nextMth  = shiftDateStr(today, 30);

  return (
    <View style={{ gap: 10 }}>
      {/* Tap to open calendar */}
      <TouchableOpacity
        onPress={() => setCalVisible(true)}
        activeOpacity={0.8}
        style={styles.datePickerTrigger}
      >
        <Feather name="calendar" size={16} color={TEAL} />
        <Text style={styles.datePickerMain}>{formatDateFull(value)}</Text>
        <Feather name="chevron-down" size={14} color={MUTED} />
      </TouchableOpacity>

      {/* Quick shortcuts */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          { label: "In a week",  val: nextWeek },
          { label: "In a month", val: nextMth  },
        ].map(({ label, val }) => (
          <TouchableOpacity
            key={label}
            onPress={() => onChange(val)}
            style={[styles.dateShortcut, value === val && { backgroundColor: TEAL, borderColor: TEAL }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateShortcutText, value === val && { color: "#fff" }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Calendar modal */}
      <Modal visible={calVisible} transparent animationType="slide">
        <View style={styles.calModalOverlay}>
          <View style={styles.calModalCard}>
            <View style={styles.calModalHeader}>
              <Text style={styles.calModalTitle}>Pick a date</Text>
              <TouchableOpacity onPress={() => setCalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>
            <Calendar
              current={value}
              onDayPress={(day: { dateString: string }) => {
                onChange(day.dateString);
                setCalVisible(false);
              }}
              markedDates={{ [value]: { selected: true, selectedColor: TEAL } }}
              theme={{
                selectedDayBackgroundColor: TEAL,
                todayTextColor: TEAL,
                arrowColor: TEAL,
                textDayFontFamily: "Inter_400Regular",
                textMonthFontFamily: "Inter_600SemiBold",
                textDayHeaderFontFamily: "Inter_500Medium",
                calendarBackground: "#fff",
                textSectionTitleColor: MUTED,
                dayTextColor: TEXT,
                monthTextColor: TEXT,
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Bill type selector (top of form) ──────────────────────────────────────────
interface BillTypeSelectorProps {
  value: BillType;
  onChange: (t: BillType) => void;
}
function BillTypeSelector({ value, onChange }: BillTypeSelectorProps) {
  return (
    <View style={typeSelS.wrap}>
      <Text style={typeSelS.question}>What kind of expense is this?</Text>
      <View style={typeSelS.row}>
        {/* Regular bill */}
        <TouchableOpacity
          style={[typeSelS.option, value === "recurring" && typeSelS.optionTealActive]}
          onPress={() => onChange("recurring")}
          activeOpacity={0.75}
        >
          <View style={[typeSelS.pill, value === "recurring" && typeSelS.pillTeal]}>
            <Text style={[typeSelS.pillText, value === "recurring" && { color: "#fff" }]}>Regular bill</Text>
          </View>
          <Text style={[typeSelS.sub, value === "recurring" && typeSelS.subActive]}>
            Happens every month — rent, utilities, subscriptions.
          </Text>
        </TouchableOpacity>

        {/* One-off expense */}
        <TouchableOpacity
          style={[typeSelS.option, value === "oneOff" && typeSelS.optionGoldActive]}
          onPress={() => onChange("oneOff")}
          activeOpacity={0.75}
        >
          <View style={[typeSelS.pill, value === "oneOff" && typeSelS.pillGold]}>
            <Text style={[typeSelS.pillText, value === "oneOff" && { color: "#fff" }]}>One-off expense</Text>
          </View>
          <Text style={[typeSelS.sub, value === "oneOff" && typeSelS.subActive]}>
            Outside your normal budget — rego, school fees, repairs, anything unexpected.
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const typeSelS = StyleSheet.create({
  wrap:    { paddingHorizontal: 16, paddingTop: 12 },
  question:{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  row:     { flexDirection: "row", gap: 10 },
  option:  { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, padding: 12, gap: 6 },
  optionTealActive: { borderColor: TEAL, backgroundColor: TEAL_TINT },
  optionGoldActive: { borderColor: GOLD, backgroundColor: GOLD_TINT },
  pill:    { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: BORDER },
  pillTeal:{ backgroundColor: TEAL },
  pillGold:{ backgroundColor: GOLD },
  pillText:{ fontSize: 12, fontFamily: "Inter_700Bold", color: TEXT },
  sub:     { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, lineHeight: 17 },
  subActive:{ color: TEXT },
});

// ── BillCard ──────────────────────────────────────────────────────────────────
interface BillCardProps { bill: Bill; onPress: () => void; onMarkPaid: () => void; }
function BillCard({ bill, onPress, onMarkPaid }: BillCardProps) {
  const { label, color } = statusDisplay(bill);
  const color2 = catColor(bill.category);
  const typeDot = bill.billType === "recurring" ? TEAL : GOLD;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.billCard, { borderLeftColor: color }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.typeDot, { backgroundColor: typeDot }]} />
            <Text style={styles.billTitle} numberOfLines={1}>{bill.title}</Text>
          </View>
          <Text style={styles.billMeta}>Due {formatDateShort(bill.dueDate)}</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            <StatusChip label={label} color={color} />
            <StatusChip label={bill.category} color={color2} />
            {bill.essentialLevel === "Can Wait" && <EssentialChip level={bill.essentialLevel} />}
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Text style={styles.billAmount}>${bill.amount.toFixed(2)}</Text>
          {!bill.isPaid && (
            <TouchableOpacity onPress={onMarkPaid} style={styles.markPaidBtn} activeOpacity={0.7}>
              <Text style={styles.markPaidText}>Mark paid</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
type BillView = "overview" | "form" | "detail";
type Filter   = "all" | "upcoming" | "overdue" | "paid";

export default function BillsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [bills,      setBills]      = useState<Bill[]>([]);
  const [view,       setView]       = useState<BillView>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter,     setFilter]     = useState<Filter>("all");
  const [form,       setForm]       = useState(blankForm());
  const [amtText,    setAmtText]    = useState("");

  useFocusEffect(useCallback(() => {
    loadBills().then(setBills);
  }, []));

  const selected = bills.find((b) => b.id === selectedId) ?? null;

  // ── Computed stats ─────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueCount = bills.filter((b) => computeBillStatus(b) === "Overdue").length;
  const dueThisWeekTotal = bills
    .filter((b) => {
      if (b.isPaid) return false;
      const diff = Math.floor((parseDate(b.dueDate).getTime() - today.getTime()) / 86_400_000);
      return diff >= 0 && diff <= 7;
    })
    .reduce((s, b) => s + b.amount, 0);
  const paidThisMonth = bills.filter((b) => {
    if (!b.paidDate) return false;
    const d = parseDate(b.paidDate);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;

  // ── Filtering + sorting (one-off first, then regular; both by dueDate) ─────
  const visible = bills.filter((b) => {
    const s = computeBillStatus(b);
    if (filter === "overdue")  return s === "Overdue";
    if (filter === "upcoming") return s === "Due Soon" || s === "Upcoming";
    if (filter === "paid")     return s === "Paid";
    return true;
  }).sort((a, b) => {
    // One-off expenses surface first, then regular; within each group sort by date
    if (a.billType !== b.billType) {
      return a.billType === "oneOff" ? -1 : 1;
    }
    return a.dueDate.localeCompare(b.dueDate);
  });

  const groups: { label: string; items: Bill[] }[] = [
    { label: "Overdue",  items: visible.filter((b) => computeBillStatus(b) === "Overdue") },
    { label: "Due soon", items: visible.filter((b) => computeBillStatus(b) === "Due Soon") },
    { label: "Upcoming", items: visible.filter((b) => computeBillStatus(b) === "Upcoming") },
    { label: "Paid",     items: visible.filter((b) => computeBillStatus(b) === "Paid") },
  ].filter((g) => g.items.length > 0);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(blankForm());
    setAmtText("");
    setSelectedId(null);
    setView("form");
  }

  function openEdit(id: string) {
    const b = bills.find((x) => x.id === id);
    if (!b) return;
    setForm({
      title: b.title, category: b.category, amount: b.amount,
      dueDate: b.dueDate, billType: b.billType,
      recurrenceType: b.recurrenceType,
      assignedTo: b.assignedTo ?? "",
      notes: b.notes ?? "",
      essentialLevel: b.essentialLevel,
      isPaid: b.isPaid, paidDate: b.paidDate,
    });
    setAmtText(String(b.amount));
    setSelectedId(id);
    setView("form");
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setView("detail");
  }

  async function handleSave() {
    if (!form.title.trim()) {
      Alert.alert("Add a title", "What's this bill for?");
      return;
    }
    if (form.amount <= 0) {
      Alert.alert("Add an amount", "How much is it?");
      return;
    }
    if (form.billType === "oneOff" && !form.dueDate) {
      Alert.alert("Add a due date", "One-off expenses need a due date.");
      return;
    }
    const now  = Date.now();
    const bill: Bill = {
      ...form,
      id: selectedId ?? uid(),
      billType: form.billType,
      recurrenceType: form.billType === "recurring" ? (form.recurrenceType ?? "Monthly") : undefined,
      createdAt: selectedId ? (bills.find((b) => b.id === selectedId)?.createdAt ?? now) : now,
      updatedAt: now,
    };
    const next = selectedId
      ? bills.map((b) => b.id === selectedId ? bill : b)
      : [...bills, bill];
    setBills(next);
    await saveBills(next);
    setView("overview");
  }

  async function handleDelete(id: string) {
    Alert.alert("Delete bill?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const next = bills.filter((b) => b.id !== id);
          setBills(next);
          await saveBills(next);
          setView("overview");
        },
      },
    ]);
  }

  async function handleMarkPaid(id: string) {
    const bill = bills.find((b) => b.id === id);
    if (!bill) return;
    let next: Bill[];
    if (bill.billType === "recurring" && bill.recurrenceType) {
      const nextDue = advanceDueDate(bill.dueDate, bill.recurrenceType);
      next = bills.map((b) => b.id === id
        ? { ...b, isPaid: true, paidDate: todayStr(), dueDate: nextDue, updatedAt: Date.now() }
        : b
      );
    } else {
      next = bills.map((b) => b.id === id
        ? { ...b, isPaid: true, paidDate: todayStr(), updatedAt: Date.now() }
        : b
      );
    }
    setBills(next);
    await saveBills(next);
    if (view === "detail") setView("overview");
  }

  async function handleUnpaid(id: string) {
    const next = bills.map((b) => b.id === id
      ? { ...b, isPaid: false, paidDate: undefined, updatedAt: Date.now() }
      : b
    );
    setBills(next);
    await saveBills(next);
  }

  // ── Render: Form ───────────────────────────────────────────────────────────
  if (view === "form") return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setView("overview")} style={styles.backBtn}>
              <Feather name="arrow-left" size={18} color={TEAL} />
              <Text style={styles.backText}>Bills</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>{selectedId ? "Edit bill" : "New bill"}</Text>
          </View>

          {/* Bill type selector — top of form */}
          <BillTypeSelector
            value={form.billType}
            onChange={(t) => setForm((p) => ({ ...p, billType: t }))}
          />

          {/* Section 1: Basics */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionLabel}>THE BASICS</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>What is it?</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Gas bill, Netflix, Council rates"
                placeholderTextColor={MUTED}
                value={form.title}
                onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={MUTED}
                keyboardType="decimal-pad"
                value={amtText}
                onChangeText={(t) => { setAmtText(t); setForm((p) => ({ ...p, amount: parseFloat(t) || 0 })); }}
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {BILL_CATEGORIES.map((c) => {
                  const active = form.category === c.label;
                  return (
                    <TouchableOpacity
                      key={c.label}
                      onPress={() => setForm((p) => ({ ...p, category: c.label }))}
                      style={[styles.catPill, active && { backgroundColor: c.color, borderColor: c.color }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.catPillText, active && { color: "#fff" }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Due date — labelled as required for one-off */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 6 }}>
                <Text style={styles.fieldLabel}>Due date</Text>
                {form.billType === "oneOff" && (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>required</Text>
                  </View>
                )}
              </View>
              <DatePicker value={form.dueDate} onChange={(d) => setForm((p) => ({ ...p, dueDate: d }))} />
            </View>
          </View>

          {/* Recurrence — only shown for Regular bills */}
          {form.billType === "recurring" && (
            <View style={styles.formSection}>
              <Text style={styles.formSectionLabel}>SCHEDULE</Text>
              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>How often does it repeat?</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {RECURRENCE_TYPES.map((r) => {
                    const active = form.recurrenceType === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setForm((p) => ({ ...p, recurrenceType: r }))}
                        style={[styles.catPill, active && { backgroundColor: TEAL, borderColor: TEAL }]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.catPillText, active && { color: "#fff" }]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Section 2: Extra */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionLabel}>EXTRA DETAIL</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Essential level</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {ESSENTIAL_LEVELS.map((e) => {
                  const active = form.essentialLevel === e;
                  const color  = e === "Essential" ? PLUM : e === "Flexible" ? GOLD : MUTED;
                  return (
                    <TouchableOpacity
                      key={e}
                      onPress={() => setForm((p) => ({ ...p, essentialLevel: e }))}
                      style={[styles.catPill, active && { backgroundColor: color, borderColor: color }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.catPillText, active && { color: "#fff" }]}>{e}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Assigned to (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sarah, joint"
                placeholderTextColor={MUTED}
                value={form.assignedTo}
                onChangeText={(t) => setForm((p) => ({ ...p, assignedTo: t }))}
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Notes</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: "top" }]}
                placeholder="Reference, account number, anything useful..."
                placeholderTextColor={MUTED}
                multiline
                value={form.notes}
                onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{selectedId ? "Save changes" : "Add bill"}</Text>
          </TouchableOpacity>
          {selectedId && (
            <TouchableOpacity style={styles.deleteLink} onPress={() => handleDelete(selectedId!)} activeOpacity={0.7}>
              <Text style={styles.deleteLinkText}>Delete bill</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ── Render: Detail ─────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const { label, color } = statusDisplay(selected);
    const typeLabel = selected.billType === "recurring" ? "Regular bill" : "One-off expense";
    const typeColor = selected.billType === "recurring" ? TEAL : GOLD;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 100 }}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setView("overview")} style={styles.backBtn}>
              <Feather name="arrow-left" size={18} color={TEAL} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openEdit(selected.id)} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.detailPanel, { borderLeftColor: color }]}>
            <Text style={styles.detailTitle}>{selected.title}</Text>
            <Text style={styles.detailAmount}>${selected.amount.toFixed(2)}</Text>
            <Text style={styles.detailMeta}>Due {formatDateFull(selected.dueDate)}</Text>
            {selected.assignedTo ? (
              <Text style={[styles.detailMeta, { color: TEAL }]}>Assigned to {selected.assignedTo}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <StatusChip label={label} color={color} />
            <StatusChip label={typeLabel} color={typeColor} />
            <StatusChip label={selected.category} color={catColor(selected.category)} />
            <EssentialChip level={selected.essentialLevel} />
            {selected.billType === "recurring" && selected.recurrenceType && (
              <StatusChip label={`Repeats ${selected.recurrenceType}`} color={TEAL} />
            )}
          </View>

          {selected.notes ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>NOTES</Text>
              <Text style={styles.detailBody}>{selected.notes}</Text>
            </View>
          ) : null}

          {selected.isPaid ? (
            <>
              <View style={[styles.detailSection, { backgroundColor: "#EBF7EF" }]}>
                <Text style={[styles.detailSectionLabel, { color: GREEN }]}>PAID</Text>
                <Text style={styles.detailBody}>
                  Marked paid{selected.paidDate ? ` on ${formatDateShort(selected.paidDate)}` : ""}.
                  {selected.billType === "recurring" ? ` Next due: ${formatDateFull(selected.dueDate)}.` : ""}
                </Text>
              </View>
              <TouchableOpacity style={styles.undoPaidBtn} onPress={() => handleUnpaid(selected.id)} activeOpacity={0.7}>
                <Text style={styles.undoPaidText}>Undo — mark as unpaid</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={() => handleMarkPaid(selected.id)} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Mark as paid ✓</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.deleteLink} onPress={() => handleDelete(selected.id)} activeOpacity={0.7}>
            <Text style={styles.deleteLinkText}>Delete bill</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Overview ───────────────────────────────────────────────────────
  const FILTER_TABS: { key: Filter; label: string }[] = [
    { key: "all",      label: "All"      },
    { key: "overdue",  label: "Overdue"  },
    { key: "upcoming", label: "Due soon" },
    { key: "paid",     label: "Paid"     },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate("/(tabs)/home")} style={styles.backBtn}>
          <Feather name="arrow-left" size={18} color={TEAL} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Bills</Text>
          <Text style={styles.pageSub}>{pickSummaryCopy(bills)}</Text>
        </View>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryChip, { backgroundColor: overdueCount > 0 ? "#FDECEA" : TEAL_TINT }]}>
          <Text style={[styles.summaryChipNum, { color: overdueCount > 0 ? "#C04040" : TEAL }]}>
            {overdueCount}
          </Text>
          <Text style={styles.summaryChipLabel}>Overdue</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: GOLD + "18" }]}>
          <Text style={[styles.summaryChipNum, { color: GOLD }]}>
            ${dueThisWeekTotal.toFixed(0)}
          </Text>
          <Text style={styles.summaryChipLabel}>Due this week</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: "#EBF7EF" }]}>
          <Text style={[styles.summaryChipNum, { color: GREEN }]}>{paidThisMonth}</Text>
          <Text style={styles.summaryChipLabel}>Paid this month</Text>
        </View>
      </View>

      {/* Filter row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTER_TABS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.filterTab, filter === key && styles.filterTabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === key && { color: TEAL }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bills legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: TEAL }]} />
          <Text style={styles.legendText}>Regular bill</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: GOLD }]} />
          <Text style={styles.legendText}>One-off expense</Text>
        </View>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 6, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 90 }}>
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={36} color={BORDER} />
            <Text style={styles.emptyTitle}>No bills here yet.</Text>
            <Text style={styles.emptySubtitle}>Let's not celebrate too early.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd} activeOpacity={0.8}>
              <Text style={styles.emptyBtnText}>Add first bill</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.label} style={{ gap: 6 }}>
              <Text style={styles.groupLabel}>{g.label.toUpperCase()}</Text>
              {g.items.map((b) => (
                <BillCard
                  key={b.id}
                  bill={b}
                  onPress={() => openDetail(b.id)}
                  onMarkPaid={() => handleMarkPaid(b.id)}
                />
              ))}
            </View>
          ))
        )}
        {bills.length > 0 && bills.some((b) => {
          try {
            const cat = (b.category ?? "").toLowerCase();
            const title = (b.title ?? "").toLowerCase();
            return (
              cat === "utility" ||
              cat === "utilities" ||
              cat === "energy" ||
              title.includes("electric") ||
              title.includes("energy") ||
              title.includes("gas") ||
              title.includes("power") ||
              title.includes("utility")
            );
          } catch {
            return false;
          }
        }) && (
          <View style={{ marginTop: 16 }}>
            <SavingsTipCard
              tipId="tip_energy"
              icon="⚡"
              title="When did you last compare your energy provider?"
              body="Most households on a default tariff are overpaying. If it's been over 12 months, it's worth a 2-minute check. Step 1 — compare every plan with no sales spin. Step 2 — switch via ShopBack and earn up to $200 cashback on top."
              primaryLabel="Compare all plans (no bias) →"
              primaryUrl="https://www.energymadeeasy.gov.au"
              secondaryLabel="Switch via ShopBack — earn cashback →"
              secondaryUrl="https://www.shopback.com.au/energy"
            />
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + TAB_BAR_HEIGHT + 14 }]}
        onPress={openAdd}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={22} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  pageTitle: { fontSize: 24, fontFamily: "DMSans_700Bold", color: TEXT },
  pageSub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: MUTED, fontStyle: "italic", marginTop: 1 },

  backBtn:  { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium", color: TEAL },
  editBtn: {
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: TEAL + "30",
  },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  summaryRow:       { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  summaryChip:      { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", gap: 2 },
  summaryChipNum:   { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryChipLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: MUTED },

  filterRow:      { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: "center" },
  filterTab:      { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  filterTabActive: { backgroundColor: TEAL_TINT, borderColor: TEAL + "50" },
  filterTabText:  { fontSize: 13, fontFamily: "Inter_500Medium", color: MUTED },

  legendRow: { flexDirection: "row", gap: 16, paddingHorizontal: 18, paddingBottom: 4 },
  legendItem:{ flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText:{ fontSize: 11, fontFamily: "Inter_400Regular", color: MUTED },

  groupLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: PLUM,
    letterSpacing: 0.5, marginTop: 8, marginBottom: 2,
  },

  typeDot: { width: 7, height: 7, borderRadius: 4, marginTop: 2 },

  billCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 3, padding: 14,
  },
  billTitle:   { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT, marginBottom: 2 },
  billMeta:    { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED },
  billAmount:  { fontSize: 18, fontFamily: "Inter_700Bold", color: TEXT },
  markPaidBtn: {
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: TEAL + "30",
  },
  markPaidText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL },

  emptyState:    { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle:    { fontSize: 18, fontFamily: "Inter_600SemiBold", color: TEXT },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED, fontStyle: "italic" },
  emptyBtn:      { marginTop: 12, backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:  { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },

  fab: {
    position: "absolute", right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: GREEN, alignItems: "center", justifyContent: "center",
    ...Platform.select({
      web:     { boxShadow: "0px 4px 14px rgba(74,123,94,0.4)" },
      default: { shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
    }),
  },

  formHeader:       { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 6 },
  formTitle:        { fontSize: 22, fontFamily: "DMSans_700Bold", color: TEXT },
  formSection:      { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  formSectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: PLUM, textTransform: "uppercase", letterSpacing: 0.5 },
  formCard:         { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16 },
  fieldLabel:       { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT, marginBottom: 6 },
  fieldSub:         { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED },

  requiredBadge:     { backgroundColor: GOLD_TINT, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  requiredBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: GOLD_TEXT },

  input: {
    backgroundColor: BG, borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    fontFamily: "Inter_400Regular", color: TEXT, marginBottom: 2,
  },
  catPill:     { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD },
  catPillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: MUTED },
  rowBetween:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  datePickerTrigger: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: TEAL_TINT, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  datePickerMain: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT },
  dateShortcut:     { flex: 1, borderRadius: 20, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: BORDER, backgroundColor: CARD },
  dateShortcutText: { fontSize: 12, fontFamily: "Inter_500Medium", color: MUTED },

  calModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  calModalCard: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  calModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  calModalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: TEXT },

  saveBtn:      { marginHorizontal: 16, marginTop: 20, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  deleteLink:   { marginHorizontal: 16, marginTop: 12, alignItems: "center", paddingVertical: 10 },
  deleteLinkText:{ color: "#C04040", fontSize: 14, fontFamily: "Inter_500Medium" },
  undoPaidBtn:  { marginHorizontal: 16, alignItems: "center", paddingVertical: 10 },
  undoPaidText: { color: MUTED, fontSize: 14, fontFamily: "Inter_500Medium" },

  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailPanel: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 4, padding: 16, gap: 4,
  },
  detailTitle:        { fontSize: 20, fontFamily: "DMSans_700Bold", color: TEXT },
  detailAmount:       { fontSize: 28, fontFamily: "Inter_700Bold", color: TEXT, marginTop: 4 },
  detailMeta:         { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED },
  detailSection:      { backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 6 },
  detailSectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: PLUM, textTransform: "uppercase", letterSpacing: 0.5 },
  detailBody:         { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 21 },
});
