/**
 * upcoming.tsx — "What's Coming Up" cross-module timeline screen.
 * Also exports: WeeklyGlanceCard, ReminderStrip (used by home.tsx)
 */
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlanner } from "@/context/PlannerContext";
import allRecipesRaw from "@/data/recipes_unified_au.json";
import { loadFamilyState } from "@/utils/familyStore";
import { FamilyState } from "@/utils/familyTypes";
import { loadAppointments, Appointment } from "@/utils/appointmentStore";
import { loadBills, Bill } from "@/utils/billStore";
import {
  buildTimelineItems,
  deriveReminders,
  generateWeeklySummary,
  groupByBucket,
  filterItems,
  formatDateLabel,
  fmt12h,
  sourceColor,
  sourceLabel,
  severityColor,
  TimelineItem,
  ReminderItem,
  SourceFilter,
  DateBucket,
} from "@/utils/weeklyAggregate";

const allRecipes = allRecipesRaw as { id: string; name: string }[];

// ── Colours ────────────────────────────────────────────────────────────────────
const TEAL      = "#2A8F88";
const GOLD      = "#D29A22";
const PLUM      = "#5E3A4C";
const BG        = "#FFFFFF";
const CARD_BG   = "#FFFDF9";
const BORDER    = "#E6E1D7";
const TEXT      = "#2B2B2B";
const TEXT_MUTED= "#888888";
const TEAL_TINT = "#E6F3F0";

const EMPTY_FAMILY: FamilyState = { members: [], events: [] };

// ── Empty family for fallback ─────────────────────────────────────────────────

// ── Source chip ─────────────────────────────────────────────────────────────────
function SourceChip({ type }: { type: TimelineItem["sourceType"] }) {
  const color = sourceColor(type);
  return (
    <View style={[chipStyles.chip, { backgroundColor: color + "18", borderColor: color + "40" }]}>
      <Text style={[chipStyles.chipText, { color }]}>{sourceLabel(type)}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  chipText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
});

// ── Reminder row ──────────────────────────────────────────────────────────────
function ReminderRow({ reminder }: { reminder: ReminderItem }) {
  const color = severityColor(reminder.severity);
  return (
    <View style={[remStyles.row, { borderLeftColor: color }]}>
      <View style={[remStyles.dot, { backgroundColor: color }]} />
      <Text style={remStyles.text}>{reminder.displayText}</Text>
    </View>
  );
}

const remStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 18 },
});

// ── ReminderStrip (exported for home.tsx) ─────────────────────────────────────
export function ReminderStrip({ reminders }: { reminders: ReminderItem[] }) {
  if (reminders.length === 0) return null;
  const top = reminders.slice(0, 3);
  return (
    <View style={rsStyles.wrap}>
      <Text style={rsStyles.label}>ON THE RADAR</Text>
      {top.map((r) => <ReminderRow key={r.id} reminder={r} />)}
    </View>
  );
}

const rsStyles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FDF9F4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 8,
  },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED, letterSpacing: 1 },
});

// ── WeeklyGlanceCard (exported for home.tsx) ───────────────────────────────────
export function WeeklyGlanceCard({
  items,
  bills,
  onViewAll,
}: {
  items:     TimelineItem[];
  bills:     Bill[];
  onViewAll: () => void;
}) {
  const { headline, chips } = generateWeeklySummary(items, bills);
  if (items.length === 0 && bills.length === 0) return null;

  return (
    <TouchableOpacity
      onPress={onViewAll}
      activeOpacity={0.82}
      style={wgStyles.card}
    >
      <View style={wgStyles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={wgStyles.eyebrow}>WHAT'S COMING UP</Text>
          <Text style={wgStyles.headline}>{headline}</Text>
        </View>
        <View style={wgStyles.chevronWrap}>
          <Feather name="chevron-right" size={16} color={TEAL} />
        </View>
      </View>

      {chips.length > 0 && (
        <View style={wgStyles.chipsRow}>
          {chips.map((chip) => (
            <View key={chip} style={wgStyles.chipPill}>
              <Text style={wgStyles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={wgStyles.cta}>See full timeline →</Text>
    </TouchableOpacity>
  );
}

const wgStyles = StyleSheet.create({
  card: {
    backgroundColor: TEAL_TINT,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: TEAL + "30",
    ...Platform.select({
      web:     { boxShadow: "0px 1px 6px rgba(42,143,136,0.10)" },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 1 },
    }),
  },
  topRow:   { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  eyebrow:  { fontSize: 10, fontFamily: "Inter_600SemiBold", color: TEAL + "99", letterSpacing: 1 },
  headline: { fontSize: 16, fontFamily: "DMSans_600SemiBold", color: TEXT, marginTop: 2, lineHeight: 22 },
  chevronWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: TEAL + "18",
    alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  chipsRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipPill:  { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: TEAL + "25" },
  chipText:  { fontSize: 12, fontFamily: "Inter_500Medium", color: TEAL },
  cta:       { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", color: TEAL + "AA" },
});

// ── Filter chip row ────────────────────────────────────────────────────────────
function FilterChip({
  label,
  active,
  color,
  onPress,
}: {
  label:   string;
  active:  boolean;
  color?:  string;
  onPress: () => void;
}) {
  const c = color ?? TEAL;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[fcStyles.chip, active && { backgroundColor: c + "18", borderColor: c }]}
    >
      <Text style={[fcStyles.chipText, active && { color: c }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const fcStyles = StyleSheet.create({
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: CARD_BG,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: TEXT_MUTED },
});

// ── Timeline item card ─────────────────────────────────────────────────────────
function TimelineCard({
  item,
  onPress,
}: {
  item:    TimelineItem;
  onPress: () => void;
}) {
  const borderColor =
    item.urgencyLevel === "important" ? "#C04040"
    : item.urgencyLevel === "heads_up" ? GOLD
    : sourceColor(item.sourceType);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[tcStyles.card, { borderLeftColor: borderColor }]}
    >
      <View style={tcStyles.topRow}>
        <SourceChip type={item.sourceType} />
        {item.status ? (
          <View style={[tcStyles.statusChip, {
            backgroundColor: item.status === "Overdue" || item.urgencyLevel === "important" ? "#FDF2F0" : "#FFF8EC",
            borderColor: item.urgencyLevel === "important" ? "#E05C5C30" : GOLD + "30",
          }]}>
            <Text style={[tcStyles.statusText, {
              color: item.urgencyLevel === "important" ? "#C04040" : GOLD,
            }]}>
              {item.status}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {(item.date || item.time) && (
          <Text style={tcStyles.dateLabel}>
            {item.date ? formatDateLabel(item.date) : ""}
            {item.time ? `  ${fmt12h(item.time)}` : ""}
          </Text>
        )}
      </View>

      <Text style={tcStyles.title}>{item.title}</Text>

      <View style={tcStyles.bottomRow}>
        {item.assignedTo ? (
          <Text style={tcStyles.assignedTo}>For: {item.assignedTo}</Text>
        ) : null}
        {item.secondaryText ? (
          <Text style={tcStyles.secondary}>{item.secondaryText}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const tcStyles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    padding: 14,
    gap: 6,
  },
  topRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  statusChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  dateLabel:  { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  title:      { fontSize: 15, fontFamily: "DMSans_600SemiBold", color: TEXT, lineHeight: 20 },
  bottomRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  assignedTo: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  secondary:  { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },
});

// ── Bucket section header ─────────────────────────────────────────────────────
function BucketHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={bhStyles.row}>
      <Text style={bhStyles.label}>{label}</Text>
      <View style={bhStyles.badge}>
        <Text style={bhStyles.badgeText}>{count}</Text>
      </View>
    </View>
  );
}

const bhStyles = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2, marginTop: 8 },
  label:     { fontSize: 11, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED, letterSpacing: 0.8 },
  badge:     { backgroundColor: BORDER, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
});

// ── Source filter config ──────────────────────────────────────────────────────
const SOURCE_FILTERS: Array<{ key: SourceFilter; label: string; color: string }> = [
  { key: "all",         label: "All",          color: TEAL },
  { key: "meal",        label: "Meals",        color: GOLD },
  { key: "juggle",      label: "Juggle",       color: TEAL },
  { key: "appointment", label: "Appointments", color: PLUM },
  { key: "bill",        label: "Bills",        color: "#2A8F88" },
];

const BUCKET_LABELS: Record<DateBucket, string> = {
  overdue:   "OVERDUE",
  today:     "TODAY",
  tomorrow:  "TOMORROW",
  this_week: "THIS WEEK",
  later:     "LATER",
};

// ── Main screen ───────────────────────────────────────────────────────────────
export default function UpcomingScreen() {
  const router            = useRouter();
  const { currentPlan }   = usePlanner();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bills,        setBills]        = useState<Bill[]>([]);
  const [familyState,  setFamilyState]  = useState<FamilyState>(EMPTY_FAMILY);
  const [items,        setItems]        = useState<TimelineItem[]>([]);
  const [reminders,    setReminders]    = useState<ReminderItem[]>([]);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [appts, bls, fstate] = await Promise.all([
          loadAppointments(),
          loadBills(),
          loadFamilyState(),
        ]);
        setAppointments(appts);
        setBills(bls);
        setFamilyState(fstate);

        const built = buildTimelineItems({
          plan:         currentPlan,
          recipes:      allRecipes,
          appointments: appts,
          bills:        bls,
          familyState:  fstate,
        });
        setItems(built);
        setReminders(deriveReminders({ appointments: appts, bills: bls, familyState: fstate }));
      })();
    }, [currentPlan])
  );

  // Person filter options from family members
  const personOptions = [
    { key: "all", label: "Everyone" },
    ...familyState.members.map((m) => ({ key: m.name.toLowerCase(), label: m.name })),
  ];

  const filtered = filterItems(items, sourceFilter, personFilter);
  const grouped  = groupByBucket(filtered);
  const { headline, chips } = generateWeeklySummary(items, bills);
  const bucketOrder: DateBucket[] = ["overdue", "today", "tomorrow", "this_week", "later"];

  const routeForSource = (type: TimelineItem["sourceType"]) => {
    if (type === "appointment") return "/(tabs)/appointments";
    if (type === "bill")        return "/(tabs)/bills";
    if (type === "juggle")      return "/(tabs)/family";
    return "/(tabs)/meals";
  };

  const totalUpcoming = items.filter((i) => i.date && i.date >= new Date().toISOString().slice(0, 10)).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push("/(tabs)/home")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={20} color={TEAL} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>What's Coming Up</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary panel */}
        <View style={styles.summaryPanel}>
          <Text style={styles.summaryHeadline}>{headline}</Text>
          {chips.length > 0 && (
            <View style={styles.summaryChips}>
              {chips.map((chip) => (
                <View key={chip} style={styles.summaryChipPill}>
                  <Text style={styles.summaryChipText}>{chip}</Text>
                </View>
              ))}
            </View>
          )}
          {totalUpcoming > 0 && (
            <Text style={styles.summaryCount}>
              {totalUpcoming} item{totalUpcoming !== 1 ? "s" : ""} in the next 7 days
            </Text>
          )}
        </View>

        {/* Reminder strip */}
        {reminders.length > 0 && (
          <View style={styles.section}>
            <ReminderStrip reminders={reminders} />
          </View>
        )}

        {/* Source filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {SOURCE_FILTERS.map(({ key, label, color }) => (
            <FilterChip
              key={key}
              label={label}
              active={sourceFilter === key}
              color={color}
              onPress={() => setSourceFilter(key)}
            />
          ))}
        </ScrollView>

        {/* Person filter (only if family members exist) */}
        {personOptions.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterRow, { marginTop: -4 }]}
          >
            {personOptions.map(({ key, label }) => (
              <FilterChip
                key={key}
                label={label}
                active={personFilter === key}
                color={TEXT_MUTED}
                onPress={() => setPersonFilter(key)}
              />
            ))}
          </ScrollView>
        )}

        {/* Timeline */}
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="sun" size={32} color={BORDER} />
            <Text style={styles.emptyTitle}>Nothing major coming up.</Text>
            <Text style={styles.emptySub}>Frankly, love that for you.</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {bucketOrder.map((bucket) => {
              const bucketItems = grouped[bucket];
              if (bucketItems.length === 0) return null;
              return (
                <View key={bucket}>
                  <BucketHeader
                    label={BUCKET_LABELS[bucket]}
                    count={bucketItems.length}
                  />
                  <View style={{ gap: 8 }}>
                    {bucketItems.map((item) => (
                      <TimelineCard
                        key={item.id}
                        item={item}
                        onPress={() => router.push(routeForSource(item.sourceType) as any)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ paddingBottom: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  header:    {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "DMSans_600SemiBold", color: TEXT },

  container: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  summaryPanel: {
    backgroundColor: TEAL_TINT,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: TEAL + "30",
  },
  summaryHeadline: { fontSize: 17, fontFamily: "DMSans_600SemiBold", color: TEXT },
  summaryChips:    { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  summaryChipPill: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: TEAL + "25",
  },
  summaryChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: TEAL },
  summaryCount:    { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },

  section:   { },

  filterRow: { gap: 8, paddingVertical: 4 },

  timeline:  { gap: 16 },

  emptyState: {
    alignItems: "center",
    paddingVertical: 56,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontFamily: "DMSans_600SemiBold", color: TEXT },
  emptySub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },
});
