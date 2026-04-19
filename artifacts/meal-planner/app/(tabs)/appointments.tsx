import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Appointment,
  ChecklistItem,
  loadAppointments,
  saveAppointments,
} from "@/utils/appointmentStore";

// ── Colour tokens ──────────────────────────────────────────────────────────────
const TEAL      = "#2A8F88";
const GOLD      = "#D29A22";
const PLUM      = "#5E3A4C";
const ORANGE    = "#E07B3A";
const BG        = "#F7F3EB";
const CARD      = "#FFFFFF";
const BORDER    = "#E6E1D7";
const TEXT      = "#2B2B2B";
const MUTED     = "#888888";
const TEAL_TINT = "#E6F3F0";

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORIES: { label: string; color: string }[] = [
  { label: "Medical",       color: TEAL   },
  { label: "School",        color: PLUM   },
  { label: "Kids Activity", color: GOLD   },
  { label: "Personal",      color: "#6B8F71" },
  { label: "Work",          color: "#4A6FA5" },
  { label: "Beauty",        color: "#C9748A" },
  { label: "Vet",           color: "#8B6B5A" },
  { label: "Other",         color: MUTED  },
];

function categoryColor(cat: string): string {
  return CATEGORIES.find((c) => c.label === cat)?.color ?? MUTED;
}

// ── Time slots ─────────────────────────────────────────────────────────────────
const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 7; h <= 21; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) break;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
})();

// ── Date utilities ─────────────────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_FULL    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TAB_BAR_HEIGHT = Platform.OS === "web" ? 72 : 58;

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
  return `${DAYS_FULL[d.getDay()]?.slice(0, 3)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function fmt12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h!) || isNaN(m!)) return hhmm;
  const period = h! >= 12 ? "pm" : "am";
  const hour   = h! % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

type DateGroup = "today" | "tomorrow" | "this_week" | "later" | "past";

function getGroup(dateStr: string): DateGroup {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = parseDate(dateStr);
  const diff  = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)  return "past";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 6)  return "this_week";
  return "later";
}

function needsPrep(a: Appointment): boolean {
  return a.checklist.length > 0 && a.checklist.some((i) => !i.done) && !a.isDone;
}

// ── Blank form ─────────────────────────────────────────────────────────────────
function blankForm(): Omit<Appointment, "id" | "createdAt" | "updatedAt"> {
  return {
    title: "",
    category: "Medical",
    date: todayStr(),
    startTime: "09:00",
    endTime: undefined,
    person: "",
    locationName: "",
    suburb: "",
    notes: "",
    checklist: [],
    reminderEnabled: false,
    recurringEnabled: false,
    isDone: false,
    isCancelled: false,
  };
}

function uid(): string {
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Overview summary copy ──────────────────────────────────────────────────────
const OVERVIEW_COPY: string[] = [
  "A future-you favour, captured.",
  "Nothing lost in the mental tabs.",
  "One less thing to keep in your head.",
  "A few things on the radar.",
  "This week has a couple of moving parts.",
  "You're not wildly overbooked. A win.",
];
function pickCopy(items: Appointment[]): string {
  const upcoming = items.filter((a) => !a.isDone && !a.isCancelled);
  if (upcoming.length === 0) return "Nothing booked yet. A rare and beautiful sight.";
  if (upcoming.length === 1) return "One thing on. Easier than it sounds.";
  if (upcoming.length <= 3)  return "A couple of things on the radar.";
  if (upcoming.length <= 6)  return "You've got a bit on. All captured though.";
  return "Quite the social calendar. Stay hydrated.";
}

// ── Components ─────────────────────────────────────────────────────────────────

function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[chipStyles.chip, { backgroundColor: color + "18" }]}>
      <Text style={[chipStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIdx = TIME_SLOTS.indexOf(value);
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
      onLayout={() => {
        if (selectedIdx > 0) scrollRef.current?.scrollTo({ x: selectedIdx * 60, animated: false });
      }}
    >
      {TIME_SLOTS.map((t) => {
        const active = value === t;
        return (
          <TouchableOpacity
            key={t}
            onPress={() => onChange(t)}
            style={[styles.timeSlot, active && { backgroundColor: TEAL, borderColor: TEAL }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.timeSlotText, active && { color: "#fff" }]}>{fmt12h(t)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today    = todayStr();
  const tomorrow = shiftDateStr(today, 1);
  const nextWeek = shiftDateStr(today, 7);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.datePickerRow}>
        <TouchableOpacity onPress={() => onChange(shiftDateStr(value, -1))} style={styles.dateArrow}>
          <Feather name="chevron-left" size={20} color={TEAL} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.datePickerMain}>{formatDateFull(value)}</Text>
        </View>
        <TouchableOpacity onPress={() => onChange(shiftDateStr(value, 1))} style={styles.dateArrow}>
          <Feather name="chevron-right" size={20} color={TEAL} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          { label: "Today",    val: today    },
          { label: "Tomorrow", val: tomorrow },
          { label: "Next week",val: nextWeek },
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
    </View>
  );
}

interface ApptCardProps {
  appt: Appointment;
  busyPersons?: string[];
  onPress: () => void;
}
function ApptCard({ appt, busyPersons, onPress }: ApptCardProps) {
  const color   = categoryColor(appt.category);
  const prep    = needsPrep(appt);
  const timeStr = fmt12h(appt.startTime) + (appt.endTime ? `–${fmt12h(appt.endTime)}` : "");
  const isBusy  = busyPersons && appt.person && busyPersons.includes(appt.person);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.apptCard, { borderLeftColor: color }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.apptTitle} numberOfLines={1}>{appt.title}</Text>
          <Text style={styles.apptMeta}>
            {formatDateShort(appt.date)} · {timeStr}
            {appt.person ? ` · ${appt.person}` : ""}
          </Text>
          {(appt.locationName || appt.suburb) ? (
            <Text style={styles.apptLocation} numberOfLines={1}>
              {[appt.locationName, appt.suburb].filter(Boolean).join(", ")}
            </Text>
          ) : null}
          {isBusy ? (
            <Text style={styles.apptBusy}>Bit of a juggle for {appt.person} that day.</Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <StatusChip label={appt.category} color={color} />
          {prep ? <StatusChip label="Needs prep" color={ORANGE} /> : null}
          {appt.isDone ? <StatusChip label="Done" color="#4A7B5E" /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

type ApptView = "overview" | "form" | "detail";
type Filter   = "all" | "today" | "week" | "needs_prep";

export default function AppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items,       setItems]       = useState<Appointment[]>([]);
  const [view,        setView]        = useState<ApptView>("overview");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [filter,      setFilter]      = useState<Filter>("all");
  const [form,        setForm]        = useState(blankForm());
  const [showEndTime, setShowEndTime] = useState(false);
  const [checkInput,  setCheckInput]  = useState("");

  useFocusEffect(useCallback(() => {
    loadAppointments().then(setItems);
  }, []));

  const selected = items.find((a) => a.id === selectedId) ?? null;

  // ── Filtering & grouping ───────────────────────────────────────────────────
  const visible = items.filter((a) => {
    if (a.isDone || a.isCancelled) return filter === "all";
    const g = getGroup(a.date);
    if (filter === "today")      return g === "today";
    if (filter === "week")       return g === "today" || g === "tomorrow" || g === "this_week";
    if (filter === "needs_prep") return needsPrep(a);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const groups: { label: string; key: DateGroup | "done"; items: Appointment[] }[] = [
    { label: "Today",     key: "today",     items: visible.filter((a) => getGroup(a.date) === "today"     && !a.isDone) },
    { label: "Tomorrow",  key: "tomorrow",  items: visible.filter((a) => getGroup(a.date) === "tomorrow"  && !a.isDone) },
    { label: "This week", key: "this_week", items: visible.filter((a) => getGroup(a.date) === "this_week" && !a.isDone) },
    { label: "Coming up", key: "later",     items: visible.filter((a) => getGroup(a.date) === "later"     && !a.isDone) },
    { label: "Done",      key: "done",      items: visible.filter((a) => a.isDone || getGroup(a.date) === "past") },
  ].filter((g) => g.items.length > 0);

  // Busy-day detection
  const dayPersonCount: Record<string, Record<string, number>> = {};
  for (const a of items.filter((a) => !a.isDone && !a.isCancelled)) {
    if (!dayPersonCount[a.date]) dayPersonCount[a.date] = {};
    dayPersonCount[a.date]![a.person] = (dayPersonCount[a.date]![a.person] ?? 0) + 1;
  }
  const busyDayPersons: Record<string, string[]> = {};
  for (const [date, pc] of Object.entries(dayPersonCount)) {
    const busy = Object.entries(pc).filter(([, n]) => n >= 2).map(([p]) => p);
    if (busy.length) busyDayPersons[date] = busy;
  }

  // Summary counts
  const countToday   = items.filter((a) => !a.isDone && !a.isCancelled && getGroup(a.date) === "today").length;
  const countWeek    = items.filter((a) => !a.isDone && !a.isCancelled && ["today","tomorrow","this_week"].includes(getGroup(a.date))).length;
  const countPrep    = items.filter(needsPrep).length;

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(blankForm());
    setShowEndTime(false);
    setCheckInput("");
    setSelectedId(null);
    setView("form");
  }

  function openEdit(id: string) {
    const a = items.find((x) => x.id === id);
    if (!a) return;
    setForm({
      title: a.title, category: a.category, date: a.date,
      startTime: a.startTime, endTime: a.endTime,
      person: a.person, locationName: a.locationName ?? "",
      suburb: a.suburb ?? "", notes: a.notes ?? "",
      checklist: [...a.checklist],
      reminderEnabled: a.reminderEnabled,
      recurringEnabled: a.recurringEnabled,
      isDone: a.isDone, isCancelled: a.isCancelled,
    });
    setShowEndTime(!!a.endTime);
    setCheckInput("");
    setSelectedId(id);
    setView("form");
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setView("detail");
  }

  async function handleSave() {
    if (!form.title.trim()) {
      Alert.alert("Add a title", "What's the appointment for?");
      return;
    }
    const now = Date.now();
    let next: Appointment[];
    if (selectedId) {
      next = items.map((a) => a.id === selectedId
        ? { ...a, ...form, endTime: showEndTime ? form.endTime : undefined, updatedAt: now }
        : a
      );
    } else {
      const appt: Appointment = {
        id: uid(), ...form,
        endTime: showEndTime ? form.endTime : undefined,
        createdAt: now, updatedAt: now,
      };
      next = [...items, appt];
    }
    setItems(next);
    await saveAppointments(next);
    setView("overview");
  }

  async function handleDelete(id: string) {
    Alert.alert("Delete appointment?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const next = items.filter((a) => a.id !== id);
          setItems(next);
          await saveAppointments(next);
          setView("overview");
        },
      },
    ]);
  }

  async function handleMarkDone(id: string) {
    const next = items.map((a) => a.id === id ? { ...a, isDone: !a.isDone, updatedAt: Date.now() } : a);
    setItems(next);
    await saveAppointments(next);
    if (view === "detail") setView("overview");
  }

  async function handleChecklistToggle(apptId: string, itemId: string) {
    const next = items.map((a) => a.id !== apptId ? a : {
      ...a,
      checklist: a.checklist.map((c) => c.id === itemId ? { ...c, done: !c.done } : c),
      updatedAt: Date.now(),
    });
    setItems(next);
    await saveAppointments(next);
  }

  function addChecklistItem() {
    const text = checkInput.trim();
    if (!text) return;
    setForm((prev) => ({
      ...prev,
      checklist: [...prev.checklist, { id: uid(), text, done: false }],
    }));
    setCheckInput("");
  }

  function removeChecklistItem(itemId: string) {
    setForm((prev) => ({ ...prev, checklist: prev.checklist.filter((c) => c.id !== itemId) }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === "form") return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setView("overview")} style={styles.backBtn}>
              <Feather name="arrow-left" size={18} color={TEAL} />
              <Text style={styles.backText}>Appointments</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>{selectedId ? "Edit appointment" : "New appointment"}</Text>
          </View>

          {/* Section 1: Basics */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionLabel}>THE BASICS</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>What is it?</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Dentist, School play, GP checkup"
                placeholderTextColor={MUTED}
                value={form.title}
                onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {CATEGORIES.map((c) => {
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

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Who's this for?</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Emma, Mum, whole family"
                placeholderTextColor={MUTED}
                value={form.person}
                onChangeText={(t) => setForm((p) => ({ ...p, person: t }))}
              />
            </View>
          </View>

          {/* Section 2: When */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionLabel}>WHEN</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Date</Text>
              <DatePicker value={form.date} onChange={(d) => setForm((p) => ({ ...p, date: d }))} />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Start time</Text>
              <TimePicker value={form.startTime} onChange={(t) => setForm((p) => ({ ...p, startTime: t }))} />

              <View style={[styles.rowBetween, { marginTop: 16 }]}>
                <Text style={styles.fieldLabel}>End time (optional)</Text>
                <Switch
                  value={showEndTime}
                  onValueChange={setShowEndTime}
                  trackColor={{ false: BORDER, true: TEAL + "60" }}
                  thumbColor={showEndTime ? TEAL : "#ccc"}
                />
              </View>
              {showEndTime && (
                <TimePicker
                  value={form.endTime ?? form.startTime}
                  onChange={(t) => setForm((p) => ({ ...p, endTime: t }))}
                />
              )}
            </View>
          </View>

          {/* Section 3: Where */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionLabel}>WHERE</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Location name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. City Medical Centre"
                placeholderTextColor={MUTED}
                value={form.locationName}
                onChangeText={(t) => setForm((p) => ({ ...p, locationName: t }))}
              />
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Suburb</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Fitzroy"
                placeholderTextColor={MUTED}
                value={form.suburb}
                onChangeText={(t) => setForm((p) => ({ ...p, suburb: t }))}
              />
            </View>
          </View>

          {/* Section 4: Extras */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionLabel}>USEFUL EXTRAS</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                placeholder="Anything worth remembering..."
                placeholderTextColor={MUTED}
                multiline
                value={form.notes}
                onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))}
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Prep checklist</Text>
              {form.checklist.map((item) => (
                <View key={item.id} style={styles.checkRow}>
                  <Text style={styles.checkText}>{item.text}</Text>
                  <TouchableOpacity onPress={() => removeChecklistItem(item.id)}>
                    <Feather name="x" size={14} color={MUTED} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.checkInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Add a prep item..."
                  placeholderTextColor={MUTED}
                  value={checkInput}
                  onChangeText={setCheckInput}
                  onSubmitEditing={addChecklistItem}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={addChecklistItem} style={styles.addCheckBtn}>
                  <Feather name="plus" size={16} color={TEAL} />
                </TouchableOpacity>
              </View>

              <View style={[styles.rowBetween, { marginTop: 14 }]}>
                <View>
                  <Text style={styles.fieldLabel}>Reminder</Text>
                  <Text style={styles.fieldSub}>A tiny bit of admin, now saving chaos later.</Text>
                </View>
                <Switch
                  value={form.reminderEnabled}
                  onValueChange={(v) => setForm((p) => ({ ...p, reminderEnabled: v }))}
                  trackColor={{ false: BORDER, true: TEAL + "60" }}
                  thumbColor={form.reminderEnabled ? TEAL : "#ccc"}
                />
              </View>

              <View style={[styles.rowBetween, { marginTop: 14 }]}>
                <View>
                  <Text style={styles.fieldLabel}>Recurring</Text>
                  <Text style={styles.fieldSub}>Repeats each week or term</Text>
                </View>
                <Switch
                  value={form.recurringEnabled}
                  onValueChange={(v) => setForm((p) => ({ ...p, recurringEnabled: v }))}
                  trackColor={{ false: BORDER, true: TEAL + "60" }}
                  thumbColor={form.recurringEnabled ? TEAL : "#ccc"}
                />
              </View>
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{selectedId ? "Save changes" : "Add appointment"}</Text>
          </TouchableOpacity>
          {selectedId && (
            <TouchableOpacity style={styles.deleteLink} onPress={() => handleDelete(selectedId!)} activeOpacity={0.7}>
              <Text style={styles.deleteLinkText}>Delete appointment</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (view === "detail" && selected) return (
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

        <View style={[styles.detailPanel, { borderLeftColor: categoryColor(selected.category) }]}>
          <Text style={styles.detailTitle}>{selected.title}</Text>
          <Text style={styles.detailMeta}>
            {formatDateFull(selected.date)}
          </Text>
          <Text style={styles.detailMeta}>
            {fmt12h(selected.startTime)}{selected.endTime ? ` – ${fmt12h(selected.endTime)}` : ""}
          </Text>
          {selected.person ? (
            <Text style={[styles.detailMeta, { color: TEAL }]}>For {selected.person}</Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatusChip label={selected.category} color={categoryColor(selected.category)} />
          {needsPrep(selected) && <StatusChip label="Needs prep" color={ORANGE} />}
          {selected.isDone && <StatusChip label="Done ✓" color="#4A7B5E" />}
          {selected.reminderEnabled && <StatusChip label="Reminder on" color={PLUM} />}
          {selected.recurringEnabled && <StatusChip label="Recurring" color={GOLD} />}
        </View>

        {(selected.locationName || selected.suburb) ? (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>LOCATION</Text>
            <Text style={styles.detailBody}>
              {[selected.locationName, selected.suburb].filter(Boolean).join(", ")}
            </Text>
          </View>
        ) : null}

        {selected.notes ? (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>NOTES</Text>
            <Text style={styles.detailBody}>{selected.notes}</Text>
          </View>
        ) : null}

        {selected.checklist.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>PREP CHECKLIST</Text>
            {selected.checklist.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.checkToggleRow}
                onPress={() => handleChecklistToggle(selected.id, item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, item.done && { backgroundColor: TEAL, borderColor: TEAL }]}>
                  {item.done && <Feather name="check" size={11} color="#fff" />}
                </View>
                <Text style={[styles.checkToggleText, item.done && { textDecorationLine: "line-through", color: MUTED }]}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, selected.isDone && { backgroundColor: "#E8F4EC" }]}
          onPress={() => handleMarkDone(selected.id)}
          activeOpacity={0.8}
        >
          <Text style={[styles.saveBtnText, selected.isDone && { color: "#4A7B5E" }]}>
            {selected.isDone ? "Mark as upcoming" : "Mark as done ✓"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteLink} onPress={() => handleDelete(selected.id)} activeOpacity={0.7}>
          <Text style={styles.deleteLinkText}>Delete appointment</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Overview ───────────────────────────────────────────────────────────────
  const FILTER_TABS: { key: Filter; label: string }[] = [
    { key: "all",       label: "All"        },
    { key: "today",     label: "Today"      },
    { key: "week",      label: "This week"  },
    { key: "needs_prep",label: "Needs prep" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/more")} style={styles.backBtn}>
          <Feather name="arrow-left" size={18} color={TEAL} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Appointments</Text>
          <Text style={styles.pageSub}>{pickCopy(items)}</Text>
        </View>
      </View>

      {/* Summary chips */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryChip, { backgroundColor: TEAL_TINT }]}>
          <Text style={[styles.summaryChipNum, { color: TEAL }]}>{countToday}</Text>
          <Text style={styles.summaryChipLabel}>Today</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: "#F3EDF5" }]}>
          <Text style={[styles.summaryChipNum, { color: PLUM }]}>{countWeek}</Text>
          <Text style={styles.summaryChipLabel}>This week</Text>
        </View>
        {countPrep > 0 && (
          <View style={[styles.summaryChip, { backgroundColor: ORANGE + "18" }]}>
            <Text style={[styles.summaryChipNum, { color: ORANGE }]}>{countPrep}</Text>
            <Text style={styles.summaryChipLabel}>Needs prep</Text>
          </View>
        )}
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

      {/* List */}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 6, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 90 }}>
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={36} color={BORDER} />
            <Text style={styles.emptyTitle}>Nothing booked yet.</Text>
            <Text style={styles.emptySubtitle}>A rare and beautiful sight.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd} activeOpacity={0.8}>
              <Text style={styles.emptyBtnText}>Add first appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.key} style={{ gap: 6 }}>
              <Text style={styles.groupLabel}>{g.label.toUpperCase()}</Text>
              {g.items.map((a) => (
                <ApptCard
                  key={a.id}
                  appt={a}
                  busyPersons={busyDayPersons[a.date]}
                  onPress={() => openDetail(a.id)}
                />
              ))}
            </View>
          ))
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
  pageTitle: { fontSize: 24, fontFamily: "Manrope_700Bold", color: TEXT },
  pageSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: MUTED, fontStyle: "italic", marginTop: 1 },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium", color: TEAL },
  editBtn: {
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: TEAL + "30",
  },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  summaryRow: {
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 8,
  },
  summaryChip: {
    flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", gap: 2,
  },
  summaryChipNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryChipLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: MUTED },

  filterRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: "center" },
  filterTab: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  filterTabActive: { backgroundColor: TEAL_TINT, borderColor: TEAL + "50" },
  filterTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: MUTED },

  groupLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: PLUM,
    letterSpacing: 0.5, marginTop: 8, marginBottom: 2,
  },

  apptCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 3, padding: 14,
  },
  apptTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT, marginBottom: 2 },
  apptMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED },
  apptLocation: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, marginTop: 1 },
  apptBusy: { fontSize: 12, fontFamily: "Inter_400Regular", color: GOLD, fontStyle: "italic", marginTop: 3 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: TEXT },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED, fontStyle: "italic" },
  emptyBtn: {
    marginTop: 12, backgroundColor: TEAL, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },

  fab: {
    position: "absolute", right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: TEAL, alignItems: "center", justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: "0px 4px 14px rgba(42,143,136,0.4)" },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
    }),
  },

  // Form styles
  formHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 6 },
  formTitle: { fontSize: 22, fontFamily: "Manrope_700Bold", color: TEXT },
  formSection: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  formSectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: PLUM,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  formCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16,
  },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT, marginBottom: 6 },
  fieldSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED },
  input: {
    backgroundColor: BG, borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    fontFamily: "Inter_400Regular", color: TEXT, marginBottom: 2,
  },
  catPill: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: BORDER, backgroundColor: CARD,
  },
  catPillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: MUTED },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  datePickerRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: TEAL_TINT, borderRadius: 12, padding: 10,
  },
  dateArrow: { padding: 4 },
  datePickerMain: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT, textAlign: "center" },
  dateShortcut: {
    flex: 1, borderRadius: 20, paddingVertical: 6, alignItems: "center",
    borderWidth: 1, borderColor: BORDER, backgroundColor: CARD,
  },
  dateShortcutText: { fontSize: 12, fontFamily: "Inter_500Medium", color: MUTED },

  timeSlot: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: BORDER, backgroundColor: CARD,
  },
  timeSlotText: { fontSize: 12, fontFamily: "Inter_500Medium", color: TEXT },

  checkRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F5F0EB",
  },
  checkText: { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, flex: 1 },
  checkInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  addCheckBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: TEAL_TINT, alignItems: "center", justifyContent: "center",
  },

  saveBtn: {
    marginHorizontal: 16, marginTop: 20, backgroundColor: TEAL,
    borderRadius: 14, paddingVertical: 14, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  deleteLink: { marginHorizontal: 16, marginTop: 12, alignItems: "center", paddingVertical: 10 },
  deleteLinkText: { color: "#C04040", fontSize: 14, fontFamily: "Inter_500Medium" },

  // Detail styles
  detailHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  detailPanel: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 4, padding: 16, gap: 4,
  },
  detailTitle: { fontSize: 20, fontFamily: "Manrope_700Bold", color: TEXT },
  detailMeta: { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED },
  detailSection: {
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 6,
  },
  detailSectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: PLUM,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  detailBody: { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 21 },

  checkToggleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkbox: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  checkToggleText: { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, flex: 1 },
});
