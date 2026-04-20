import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
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
import { getAppleCalendars, getUpcomingAppleEvents, requestCalendarPermission } from "@/utils/appleCalendar";
import {
  APPLE_CALENDAR_IDS_KEY,
  APPLE_CONNECTED_KEY,
  AppleCalendarMeta,
  CACHED_EVENTS_KEY,
  FAMILY_PUSHED_KEY,
  GOOGLE_CALENDAR_IDS_KEY,
  GOOGLE_CONNECTED_KEY,
  GoogleCalendarMeta,
  SortiiCalEvent,
  isNoisyCalendar,
} from "@/utils/calendarTypes";
import {
  getGoogleCalendars,
  getUpcomingGoogleEvents,
  getValidGoogleToken,
  isGoogleConfigured,
  signInWithGoogle,
} from "@/utils/googleCalendar";
import {
  loadCalendarSettings,
  pushEventToFamily,
  removeEventFromFamily,
  loadFamilyPushedEvents,
  cacheCalendarEvents,
  loadCachedCalendarEvents,
} from "@/utils/appointmentService";

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
const GOOGLE_BLUE = "#4285F4";

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

function isoToDateStr(iso: string): string {
  if (!iso) return todayStr();
  if (iso.length === 10) return iso;
  return iso.slice(0, 10);
}

function isoToTimeDisplay(iso: string): string {
  if (!iso || iso.length === 10) return "All day";
  const d = new Date(iso);
  return fmt12h(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
}

function timeAgo(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
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
function pickCopy(items: Appointment[], calCount: number): string {
  const upcoming = items.filter((a) => !a.isDone && !a.isCancelled);
  const total = upcoming.length + calCount;
  if (total === 0) return "Nothing booked yet. A rare and beautiful sight.";
  if (total === 1) return "One thing on. Easier than it sounds.";
  if (total <= 3)  return "A couple of things on the radar.";
  if (total <= 6)  return "You've got a bit on. All captured though.";
  return "Quite the social calendar. Stay hydrated.";
}

// ── Source dot colour ──────────────────────────────────────────────────────────
function sourceColor(source: SortiiCalEvent["source"]): string {
  if (source === "apple")  return "#555555";
  if (source === "google") return GOOGLE_BLUE;
  return PLUM;
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

// ── Calendar event card ─────────────────────────────────────────────────────────
interface CalEventCardProps {
  event: SortiiCalEvent;
  isPushed: boolean;
  onToggle: () => void;
}

function CalEventCard({ event, isPushed, onToggle }: CalEventCardProps) {
  const dot = sourceColor(event.source);
  const timeLabel = event.isAllDay
    ? "All day"
    : isoToTimeDisplay(event.startTime);

  return (
    <View style={styles.calCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <View style={[styles.sourceDot, { backgroundColor: dot }]} />
        {event.calendarName ? (
          <Text style={styles.calendarName} numberOfLines={1}>
            {event.calendarName}
            {event.source === "google" ? " · Google" : event.source === "apple" ? " · Apple" : ""}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={styles.timePill}>
          <Text style={styles.timePillText}>{timeLabel}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.calEventTitle} numberOfLines={2}>{event.title}</Text>
          {event.location ? (
            <Text style={styles.calEventLocation} numberOfLines={1}>{event.location}</Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={styles.pushRow}>
        <View style={styles.pushToggleTrack}>
          <View style={[styles.pushToggleThumb, isPushed && { backgroundColor: PLUM, marginLeft: 14 }]} />
        </View>
        <Text style={[styles.pushLabel, isPushed && { color: PLUM }]}>
          {isPushed ? "✦ In family plan ✓" : "Add to family plan"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Source status pill ──────────────────────────────────────────────────────────
interface SourcePillProps {
  connected: boolean;
  label: string;
  icon: string;
  onPress: () => void;
}
function SourcePill({ connected, label, icon, onPress }: SourcePillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.sourcePill, connected && { backgroundColor: TEAL_TINT, borderColor: TEAL + "40" }]}
    >
      <Text style={styles.sourcePillIcon}>{icon}</Text>
      <Text style={[styles.sourcePillText, connected && { color: TEAL }]}>
        {label}{connected ? " ✓" : ""}
      </Text>
    </TouchableOpacity>
  );
}

// ── Toast ───────────────────────────────────────────────────────────────────────
function CalToast({ msg, teal }: { msg: string; teal: boolean }) {
  return (
    <View style={[styles.toast, teal ? styles.toastTeal : styles.toastMuted]}>
      <Text style={styles.toastText}>{msg}</Text>
    </View>
  );
}

// ── Calendar selector modal ─────────────────────────────────────────────────────
interface CalSelectorProps {
  visible: boolean;
  title: string;
  subtitle: string;
  items: { id: string; label: string; color: string | null; enabled: boolean }[];
  onToggle: (id: string) => void;
  onDone: () => void;
  isLoading?: boolean;
}
function CalendarSelectorModal({ visible, title, subtitle, items, onToggle, onDone, isLoading }: CalSelectorProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>{subtitle}</Text>
          {isLoading ? (
            <Text style={[styles.modalSubtitle, { marginTop: 20 }]}>Loading your calendars…</Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onToggle(item.id)}
                  activeOpacity={0.75}
                  style={styles.calRow}
                >
                  <View style={[styles.calRowDot, { backgroundColor: item.color ?? "#888" }]} />
                  <Text style={styles.calRowLabel} numberOfLines={1}>{item.label}</Text>
                  <View style={[styles.calRowToggle, item.enabled && { backgroundColor: TEAL }]}>
                    <View style={[styles.calRowThumb, item.enabled && { marginLeft: 14 }]} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.modalDoneBtn} onPress={onDone} activeOpacity={0.85}>
            <Text style={styles.modalDoneBtnText}>Done — connect these calendars</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Connection cards (empty state) ─────────────────────────────────────────────
interface ConnectionCardsProps {
  onConnectApple: () => void;
  onConnectGoogle: () => void;
  onManual: () => void;
}
function ConnectionCards({ onConnectApple, onConnectGoogle, onManual }: ConnectionCardsProps) {
  return (
    <View style={styles.connectionWrap}>
      <View style={styles.connectionIconWrap}>
        <Text style={styles.connectionIcon}>📅</Text>
      </View>
      <Text style={styles.connectionHeading}>Everything in one place.</Text>
      <Text style={styles.connectionSub}>
        Connect your calendars and add anything else — Sortii pulls it all into one view.
      </Text>
      <TouchableOpacity style={styles.connCard} onPress={onConnectApple} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={styles.connCardTitle}>🍎  iPhone Calendar</Text>
          <Text style={styles.connCardSub}>Google, iCloud, school feeds — everything your phone has</Text>
        </View>
        <TouchableOpacity style={styles.connBtn} onPress={onConnectApple} activeOpacity={0.8}>
          <Text style={styles.connBtnText}>Connect</Text>
        </TouchableOpacity>
      </TouchableOpacity>
      <TouchableOpacity style={styles.connCard} onPress={onConnectGoogle} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={styles.connCardTitle}><Text style={{ color: GOOGLE_BLUE }}>G</Text>  Google Calendar</Text>
          <Text style={styles.connCardSub}>Connect directly to your Google account</Text>
        </View>
        <TouchableOpacity style={styles.connBtn} onPress={onConnectGoogle} activeOpacity={0.8}>
          <Text style={styles.connBtnText}>Connect</Text>
        </TouchableOpacity>
      </TouchableOpacity>
      <TouchableOpacity onPress={onManual} activeOpacity={0.7}>
        <Text style={styles.manualLink}>I'll add things manually →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

type ApptView = "overview" | "form" | "detail";
type Filter   = "all" | "today" | "week" | "needs_prep";

export default function AppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Manual appointment state ───────────────────────────────────────────────
  const [items,       setItems]       = useState<Appointment[]>([]);
  const [view,        setView]        = useState<ApptView>("overview");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [filter,      setFilter]      = useState<Filter>("all");
  const [form,        setForm]        = useState(blankForm());
  const [showEndTime, setShowEndTime] = useState(false);
  const [checkInput,  setCheckInput]  = useState("");

  // ── Calendar state ─────────────────────────────────────────────────────────
  const [calEvents,       setCalEvents]       = useState<SortiiCalEvent[]>([]);
  const [pushedIds,       setPushedIds]       = useState<Set<string>>(new Set());
  const [isRefreshing,    setIsRefreshing]    = useState(false);
  const [lastSynced,      setLastSynced]      = useState<Date | null>(null);
  const [calToast,        setCalToast]        = useState<{ msg: string; teal: boolean } | null>(null);
  const [calToastTimer,   setCalToastTimer]   = useState<ReturnType<typeof setTimeout> | null>(null);
  const [appleConnected,  setAppleConnected]  = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Apple connection flow
  const [showAppleSelector,  setShowAppleSelector]  = useState(false);
  const [appleCalendars,     setAppleCalendars]     = useState<AppleCalendarMeta[]>([]);
  const [selectedAppleCals,  setSelectedAppleCals]  = useState<Map<string, boolean>>(new Map());
  const [isConnectingApple,  setIsConnectingApple]  = useState(false);
  const [permDenied,         setPermDenied]         = useState(false);

  // Google connection flow
  const [showGoogleSelector, setShowGoogleSelector] = useState(false);
  const [googleCalendars,    setGoogleCalendars]    = useState<GoogleCalendarMeta[]>([]);
  const [selectedGoogleCals, setSelectedGoogleCals] = useState<Map<string, boolean>>(new Map());
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const selected = items.find((a) => a.id === selectedId) ?? null;

  // ── Load data ──────────────────────────────────────────────────────────────
  async function loadCalendarData(fromCache = false) {
    try {
      const settings = await loadCalendarSettings();
      setAppleConnected(settings.appleConnected);
      setGoogleConnected(settings.googleConnected);

      // Load pushed family event IDs
      const pushed = await loadFamilyPushedEvents();
      setPushedIds(new Set(pushed.map((e) => e.id)));

      if (fromCache) {
        const cached = await loadCachedCalendarEvents();
        if (cached.length > 0) setCalEvents(cached);
        return;
      }

      let events: SortiiCalEvent[] = [];
      let fetchFailed = false;

      if (settings.appleConnected && settings.appleCalendarIds.length > 0) {
        try {
          const ae = await getUpcomingAppleEvents(settings.appleCalendarIds);
          events = [...events, ...ae];
        } catch { fetchFailed = true; }
      }

      if (settings.googleConnected) {
        try {
          const token = await getValidGoogleToken();
          if (token && settings.googleCalendarIds.length > 0) {
            const ge = await getUpcomingGoogleEvents(token, settings.googleCalendarIds);
            events = [...events, ...ge];
          }
        } catch { fetchFailed = true; }
      }

      if (fetchFailed && events.length === 0) {
        const cached = await loadCachedCalendarEvents();
        if (cached.length > 0) setCalEvents(cached);
        return;
      }

      const deduped = dedupeEvents(events);
      setCalEvents(deduped);
      await cacheCalendarEvents(deduped);
      setLastSynced(new Date());
    } catch {}
  }

  function dedupeEvents(events: SortiiCalEvent[]): SortiiCalEvent[] {
    const seen = new Set<string>();
    return events.filter((e) => {
      const key = `${e.title}_${e.startTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadAppointments().then(setItems);
    await loadCalendarData(false);
    setIsRefreshing(false);
  }

  useFocusEffect(useCallback(() => {
    loadAppointments().then(setItems);
    loadCalendarData(false);
  }, []));

  // AppState foreground refresh
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        loadAppointments().then(setItems);
        loadCalendarData(false);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Calendar connection: Apple ─────────────────────────────────────────────
  async function handleConnectApple() {
    if (Platform.OS === "web") {
      showToast("iPhone Calendar works in the app. Download Sortii to connect.", false);
      return;
    }
    setIsConnectingApple(true);
    const status = await requestCalendarPermission();
    if (status === "granted") {
      const cals = await getAppleCalendars();
      const initMap = new Map<string, boolean>();
      cals.forEach((c) => initMap.set(c.id, !isNoisyCalendar(c.title)));
      setAppleCalendars(cals);
      setSelectedAppleCals(initMap);
      setPermDenied(false);
      setShowAppleSelector(true);
    } else if (status === "denied") {
      setPermDenied(true);
    } else {
      showToast("Calendar access not available on this device.", false);
    }
    setIsConnectingApple(false);
  }

  async function handleAppleSelectorDone() {
    const selectedIds = [...selectedAppleCals.entries()]
      .filter(([, on]) => on)
      .map(([id]) => id);
    await AsyncStorage.setItem(APPLE_CONNECTED_KEY, "true");
    await AsyncStorage.setItem(APPLE_CALENDAR_IDS_KEY, JSON.stringify(selectedIds));
    setAppleConnected(true);
    setShowAppleSelector(false);
    await loadCalendarData(false);
    showToast("iPhone Calendar connected ✓", true);
  }

  // ── Calendar connection: Google ────────────────────────────────────────────
  async function handleConnectGoogle() {
    // OAuth uses auth.expo.io proxy which only works on native — not in a web browser
    if (Platform.OS === "web") {
      showToast("Google Calendar works in the Sortii app on your phone.", false);
      return;
    }
    // expo-crypto (needed for PKCE) is not bundled inside the Expo Go preview app
    if ((Constants as any).appOwnership === "expo") {
      showToast("Google Calendar isn't available in the Expo Go preview — it works in the full app.", false);
      return;
    }
    if (!isGoogleConfigured()) {
      showToast("Google Calendar coming soon — use iPhone Calendar for now.", false);
      return;
    }
    setIsConnectingGoogle(true);
    try {
      const token = await signInWithGoogle();
      if (token) {
        const cals = await getGoogleCalendars(token);
        const initMap = new Map<string, boolean>();
        cals.forEach((c) => initMap.set(c.id, !isNoisyCalendar(c.summary)));
        setGoogleCalendars(cals);
        setSelectedGoogleCals(initMap);
        setShowGoogleSelector(true);
      } else {
        showToast("Sign-in cancelled.", false);
      }
    } catch {
      showToast("Couldn't connect to Google Calendar. Try again.", false);
    }
    setIsConnectingGoogle(false);
  }

  async function handleGoogleSelectorDone() {
    const selectedIds = [...selectedGoogleCals.entries()]
      .filter(([, on]) => on)
      .map(([id]) => id);
    await AsyncStorage.setItem(GOOGLE_CONNECTED_KEY, "true");
    await AsyncStorage.setItem(GOOGLE_CALENDAR_IDS_KEY, JSON.stringify(selectedIds));
    setGoogleConnected(true);
    setShowGoogleSelector(false);
    await loadCalendarData(false);
    showToast("Google Calendar connected ✓", true);
  }

  // ── Family push toggle ─────────────────────────────────────────────────────
  async function handleFamilyToggle(event: SortiiCalEvent) {
    const isOn = pushedIds.has(event.id);
    if (isOn) {
      await removeEventFromFamily(event.id);
      setPushedIds((prev) => { const next = new Set(prev); next.delete(event.id); return next; });
      showToast("Removed from family plan.", false);
    } else {
      await pushEventToFamily(event);
      setPushedIds((prev) => new Set([...prev, event.id]));
      showToast("Added to this week's family plan ✓", true);
    }
  }

  // ── Toast helper ──────────────────────────────────────────────────────────
  function showToast(msg: string, teal: boolean) {
    if (calToastTimer) clearTimeout(calToastTimer);
    setCalToast({ msg, teal });
    const t = setTimeout(() => setCalToast(null), teal ? 2000 : 1500);
    setCalToastTimer(t);
  }

  // ── Saturday bulk add ─────────────────────────────────────────────────────
  async function handleAddAllSaturday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    const saturdayDate = new Date(today);
    saturdayDate.setDate(today.getDate() + daysToSaturday);
    const saturdayStr = saturdayDate.toISOString().slice(0, 10);

    const saturdayEvents = calEvents.filter((e) => isoToDateStr(e.startTime) === saturdayStr);
    for (const ev of saturdayEvents) {
      if (!pushedIds.has(ev.id)) {
        await pushEventToFamily(ev);
      }
    }
    setPushedIds((prev) => {
      const next = new Set(prev);
      saturdayEvents.forEach((e) => next.add(e.id));
      return next;
    });
    showToast(`Added all Saturday events to family plan ✓`, true);
  }

  // ── Filtering & grouping — manual appointments ─────────────────────────────
  const visible = items.filter((a) => {
    if (a.isDone || a.isCancelled) return filter === "all";
    const g = getGroup(a.date);
    if (filter === "today")      return g === "today";
    if (filter === "week")       return g === "today" || g === "tomorrow" || g === "this_week";
    if (filter === "needs_prep") return needsPrep(a);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const apptGroups: { label: string; key: DateGroup | "done"; items: Appointment[] }[] = [
    { label: "Today",     key: "today",     items: visible.filter((a) => getGroup(a.date) === "today"     && !a.isDone) },
    { label: "Tomorrow",  key: "tomorrow",  items: visible.filter((a) => getGroup(a.date) === "tomorrow"  && !a.isDone) },
    { label: "This week", key: "this_week", items: visible.filter((a) => getGroup(a.date) === "this_week" && !a.isDone) },
    { label: "Coming up", key: "later",     items: visible.filter((a) => getGroup(a.date) === "later"     && !a.isDone) },
    { label: "Done",      key: "done",      items: visible.filter((a) => a.isDone || getGroup(a.date) === "past") },
  ].filter((g) => g.items.length > 0);

  // ── Calendar event groups ──────────────────────────────────────────────────
  const upcomingCalEvents = calEvents.filter((e) => {
    const dateStr = isoToDateStr(e.startTime);
    const g = getGroup(dateStr);
    if (filter === "today")  return g === "today";
    if (filter === "week")   return g === "today" || g === "tomorrow" || g === "this_week";
    if (filter === "needs_prep") return false;
    return g !== "past";
  });

  type CalGroup = { label: string; dateStr: string; items: SortiiCalEvent[] };
  const calGroupMap = new Map<string, CalGroup>();
  upcomingCalEvents.forEach((e) => {
    const dateStr = isoToDateStr(e.startTime);
    const g = getGroup(dateStr);
    const label =
      g === "today"     ? "Today"
      : g === "tomorrow"  ? "Tomorrow"
      : g === "this_week" ? formatDateShort(dateStr)
      : g === "later"     ? formatDateShort(dateStr)
      : "Earlier";
    if (!calGroupMap.has(dateStr)) {
      calGroupMap.set(dateStr, { label, dateStr, items: [] });
    }
    calGroupMap.get(dateStr)!.items.push(e);
  });
  const calGroups = [...calGroupMap.values()].sort(
    (a, b) => a.dateStr.localeCompare(b.dateStr)
  );

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

  // Saturday bulk suggestion
  const today2 = new Date();
  const dayOfWeek2 = today2.getDay();
  const daysToSat = (6 - dayOfWeek2 + 7) % 7 || 7;
  const satStr2 = new Date(today2.getFullYear(), today2.getMonth(), today2.getDate() + daysToSat)
    .toISOString().slice(0, 10);
  const saturdayCalEvents = calEvents.filter((e) => isoToDateStr(e.startTime) === satStr2);
  const showSaturdayBulk = saturdayCalEvents.length >= 3;

  // Summary counts
  const countToday   = items.filter((a) => !a.isDone && !a.isCancelled && getGroup(a.date) === "today").length;
  const countWeek    = items.filter((a) => !a.isDone && !a.isCancelled && ["today","tomorrow","this_week"].includes(getGroup(a.date))).length;
  const countPrep    = items.filter(needsPrep).length;
  const anyConnected = appleConnected || googleConnected;
  const noContent    = apptGroups.length === 0 && calGroups.length === 0;

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
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.detailMeta}>{formatDateFull(selected.date)}</Text>
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
      {/* Apple Calendar Selector */}
      <CalendarSelectorModal
        visible={showAppleSelector}
        title="Which calendars should we include?"
        subtitle="You can change this anytime in Settings."
        items={appleCalendars.map((c) => ({
          id: c.id,
          label: c.title,
          color: c.color,
          enabled: selectedAppleCals.get(c.id) ?? true,
        }))}
        onToggle={(id) => setSelectedAppleCals((prev) => {
          const next = new Map(prev);
          next.set(id, !next.get(id));
          return next;
        })}
        onDone={handleAppleSelectorDone}
      />

      {/* Google Calendar Selector */}
      <CalendarSelectorModal
        visible={showGoogleSelector}
        title="Which Google calendars to include?"
        subtitle="You can change this anytime in Settings."
        items={googleCalendars.map((c) => ({
          id: c.id,
          label: c.summary,
          color: c.backgroundColor,
          enabled: selectedGoogleCals.get(c.id) ?? true,
        }))}
        onToggle={(id) => setSelectedGoogleCals((prev) => {
          const next = new Map(prev);
          next.set(id, !next.get(id));
          return next;
        })}
        onDone={handleGoogleSelectorDone}
      />

      {/* Permission denied banner */}
      {permDenied && (
        <View style={styles.permBanner}>
          <Text style={styles.permBannerText}>
            Sortii needs calendar access to pull in your events.
          </Text>
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={styles.permBannerLink}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toast */}
      {calToast && <CalToast msg={calToast.msg} teal={calToast.teal} />}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/more")} style={styles.backBtn}>
          <Feather name="arrow-left" size={18} color={TEAL} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Appointments</Text>
          <Text style={styles.pageSub}>{pickCopy(items, upcomingCalEvents.length)}</Text>
        </View>
      </View>

      {/* Source status pills */}
      <View style={styles.sourcePillRow}>
        <SourcePill
          connected={appleConnected}
          label="Apple"
          icon="🍎"
          onPress={handleConnectApple}
        />
        <SourcePill
          connected={googleConnected}
          label="Google"
          icon="G"
          onPress={handleConnectGoogle}
        />
        <TouchableOpacity style={styles.sourcePill} onPress={openAdd} activeOpacity={0.75}>
          <Text style={styles.sourcePillText}>+ Add</Text>
        </TouchableOpacity>
        {lastSynced && (
          <Text style={styles.lastSynced}>Updated {timeAgo(lastSynced)}</Text>
        )}
      </View>

      {/* Summary chips — only show if there are manual appointments */}
      {apptGroups.length > 0 && (
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
      )}

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
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 6, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 90 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={TEAL} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Empty state — connection cards when nothing at all */}
        {!anyConnected && noContent && (
          <ConnectionCards
            onConnectApple={handleConnectApple}
            onConnectGoogle={handleConnectGoogle}
            onManual={openAdd}
          />
        )}

        {/* Offline/cache notice */}
        {anyConnected && calEvents.length === 0 && !isRefreshing && (
          <Text style={styles.cacheNotice}>Using your last saved events.</Text>
        )}

        {/* Saturday bulk suggestion */}
        {showSaturdayBulk && (
          <TouchableOpacity style={styles.saturdayBulkBtn} onPress={handleAddAllSaturday} activeOpacity={0.8}>
            <Text style={styles.saturdayBulkText}>
              Got a busy Saturday? Add all Saturday events to family plan
            </Text>
          </TouchableOpacity>
        )}

        {/* Calendar event groups */}
        {calGroups.map((g) => (
          <View key={g.dateStr} style={{ gap: 6 }}>
            <Text style={styles.groupLabel}>{g.label.toUpperCase()} — {formatDateShort(g.dateStr)}</Text>
            {g.items.map((e) => (
              <CalEventCard
                key={e.id}
                event={e}
                isPushed={pushedIds.has(e.id)}
                onToggle={() => handleFamilyToggle(e)}
              />
            ))}
          </View>
        ))}

        {/* Manual appointment groups */}
        {apptGroups.length === 0 && calGroups.length === 0 && anyConnected ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={36} color={BORDER} />
            <Text style={styles.emptyTitle}>Nothing in the next two weeks.</Text>
            <Text style={styles.emptySubtitle}>A rare and beautiful sight.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd} activeOpacity={0.8}>
              <Text style={styles.emptyBtnText}>Add appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          apptGroups.map((g) => (
            <View key={g.key} style={{ gap: 6 }}>
              <Text style={[styles.groupLabel, { color: MUTED }]}>ADDED — {g.label.toUpperCase()}</Text>
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

  // Source pills
  sourcePillRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, flexWrap: "wrap",
  },
  sourcePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  sourcePillIcon: { fontSize: 13 },
  sourcePillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: MUTED },
  lastSynced: { fontSize: 11, fontFamily: "Inter_400Regular", color: MUTED, marginLeft: 4 },

  summaryRow: {
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 4,
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

  // Calendar event card
  calCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14,
  },
  sourceDot: { width: 8, height: 8, borderRadius: 4 },
  calendarName: { fontSize: 11, fontFamily: "Inter_400Regular", color: MUTED, flex: 1 },
  timePill: {
    backgroundColor: PLUM, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: "flex-start", marginTop: 2,
  },
  timePillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  calEventTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT },
  calEventLocation: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, marginTop: 2 },
  pushRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F0EBE3",
  },
  pushToggleTrack: {
    width: 34, height: 20, borderRadius: 10,
    backgroundColor: BORDER, justifyContent: "center", paddingHorizontal: 3,
  },
  pushToggleThumb: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff",
    ...Platform.select({
      web: { boxShadow: "0px 1px 3px rgba(0,0,0,0.2)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    }),
  },
  pushLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: MUTED, flex: 1 },

  // Toast
  toast: {
    position: "absolute", bottom: 90, left: 20, right: 20, zIndex: 100,
    borderRadius: 12, padding: 12, alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0px 4px 14px rgba(0,0,0,0.15)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
    }),
  },
  toastTeal: { backgroundColor: TEAL },
  toastMuted: { backgroundColor: "#555" },
  toastText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Connection empty state
  connectionWrap: { alignItems: "center", paddingTop: 24, gap: 12, paddingHorizontal: 4 },
  connectionIconWrap: {
    width: 72, height: 72, borderRadius: 18, backgroundColor: TEAL_TINT,
    alignItems: "center", justifyContent: "center",
  },
  connectionIcon: { fontSize: 36 },
  connectionHeading: { fontSize: 22, fontFamily: "Manrope_700Bold", color: TEXT, textAlign: "center" },
  connectionSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: MUTED, textAlign: "center", lineHeight: 22 },
  connCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 12, width: "100%",
  },
  connCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT, marginBottom: 3 },
  connCardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, lineHeight: 18 },
  connBtn: {
    backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  connBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  manualLink: { fontSize: 14, fontFamily: "Inter_500Medium", color: TEAL, marginTop: 4 },

  // Calendar selector modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: CARD, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 40,
    ...Platform.select({
      web: { boxShadow: "0px -4px 20px rgba(0,0,0,0.12)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20 },
    }),
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER,
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: "Manrope_700Bold", color: TEXT, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: MUTED, marginBottom: 16 },
  calRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F0EB",
  },
  calRowDot: { width: 12, height: 12, borderRadius: 6 },
  calRowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: TEXT },
  calRowToggle: {
    width: 34, height: 20, borderRadius: 10,
    backgroundColor: BORDER, justifyContent: "center", paddingHorizontal: 3,
  },
  calRowThumb: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff",
  },
  modalDoneBtn: {
    marginTop: 20, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14, alignItems: "center",
  },
  modalDoneBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  // Permission denied banner
  permBanner: {
    backgroundColor: "#FFF5E6", borderBottomWidth: 1, borderBottomColor: "#F5D6A0",
    padding: 12, flexDirection: "row", gap: 12, alignItems: "center",
  },
  permBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#8B5E00" },
  permBannerLink: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Cache notice
  cacheNotice: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED,
    fontStyle: "italic", textAlign: "center", paddingVertical: 8,
  },

  // Saturday bulk
  saturdayBulkBtn: {
    borderWidth: 1.5, borderColor: TEAL, borderRadius: 14, paddingVertical: 12,
    paddingHorizontal: 16, alignItems: "center", backgroundColor: TEAL_TINT,
  },
  saturdayBulkText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEAL, textAlign: "center",
  },

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
