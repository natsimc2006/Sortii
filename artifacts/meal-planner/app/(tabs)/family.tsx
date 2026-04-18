import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ALL_DAYS,
  BusynessLevel,
  FamilyInsight,
  FamilyWeekResult,
  WeekSummaryData,
  computeFamilyWeek,
  formatTime,
  parseTime,
} from "@/utils/familyEngine";
import {
  DayOfWeek,
  FamilyEvent,
  FamilyMember,
  FamilyState,
  MEMBER_COLORS,
  RepeatType,
} from "@/utils/familyTypes";
import { loadFamilyState, saveFamilyState } from "@/utils/familyStore";

// ── Brand tokens ───────────────────────────────────────────────────────────────
const TEAL       = "#2A8F88";
const TEAL_TINT  = "#E6F3F0";
const GOLD       = "#D29A22";
const PLUM       = "#5E3A4C";
const ORANGE     = "#E07B3A";
const BG         = "#FFFFFF";
const CARD_BG    = "#FFFDF9";
const BORDER     = "#E6E1D7";
const TEXT       = "#2B2B2B";
const TEXT_MUTED = "#888888";

const DAY_ABBR: Record<DayOfWeek, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

const REPEAT_LABELS: Record<RepeatType, string> = {
  none: "One-off", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly",
};

const BUSYNESS_CONFIG: Record<BusynessLevel, { label: string; color: string }> = {
  clear:  { label: "Clear week",  color: TEXT_MUTED },
  quiet:  { label: "Quiet week",  color: TEAL },
  steady: { label: "Steady week", color: GOLD },
  busy:   { label: "Busy week",   color: ORANGE },
};

// ── Blank event draft ──────────────────────────────────────────────────────────
function blankDraft(): Omit<FamilyEvent, "id"> {
  return {
    title: "", day: "Monday", time: "", endTime: "", location: "",
    personIds: [], driverId: undefined, carpoolContact: "", repeat: "none", notes: "",
  };
}

// ── MemberChip ─────────────────────────────────────────────────────────────────
function MemberChip({
  member, selected, onPress, small,
}: { member: FamilyMember; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const bg = selected ? member.color : member.color + "18";
  const fg = selected ? "#fff" : member.color;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.memberChip,
        { backgroundColor: bg, borderColor: member.color + (selected ? "00" : "44") },
        small && styles.memberChipSmall,
      ]}
    >
      <Text style={[styles.memberChipText, { color: fg }, small && styles.memberChipTextSmall]}>
        {member.name}
      </Text>
      {member.role === "adult" && (
        <View style={[styles.roleDot, { backgroundColor: selected ? "#ffffff88" : member.color + "88" }]} />
      )}
    </TouchableOpacity>
  );
}

// ── WeekSummaryCard ────────────────────────────────────────────────────────────
function WeekSummaryCard({ summary }: { summary: WeekSummaryData }) {
  if (summary.totalEvents === 0) return null;
  const { label: busynessLabel, color: busynessColor } = BUSYNESS_CONFIG[summary.busynessLevel];

  return (
    <View style={styles.weekSummaryCard}>
      <View style={styles.weekSummaryStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{summary.totalEvents}</Text>
          <Text style={styles.statLabel}>{summary.totalEvents === 1 ? "event" : "events"}</Text>
        </View>
        {summary.weekendCount > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: GOLD }]}>{summary.weekendCount}</Text>
            <Text style={styles.statLabel}>this weekend</Text>
          </View>
        )}
        {summary.driverCount > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: TEAL }]}>{summary.driverCount}</Text>
            <Text style={styles.statLabel}>{summary.driverCount === 1 ? "driver" : "drivers"}</Text>
          </View>
        )}
        <View style={[styles.busynessPill, { backgroundColor: busynessColor + "18", borderColor: busynessColor + "44" }]}>
          <View style={[styles.busynessDot, { backgroundColor: busynessColor }]} />
          <Text style={[styles.busynessText, { color: busynessColor }]}>{busynessLabel}</Text>
        </View>
      </View>
      {summary.unassignedCount > 0 && (
        <View style={styles.unassignedNote}>
          <Feather name="alert-circle" size={12} color={TEXT_MUTED} />
          <Text style={styles.unassignedNoteText}>
            {summary.unassignedCount} {summary.unassignedCount === 1 ? "event" : "events"} with no driver assigned yet.
          </Text>
        </View>
      )}
    </View>
  );
}

// ── PlanSplitSection ───────────────────────────────────────────────────────────
function PlanSplitSection({
  planSplit,
  members,
}: {
  planSplit: Map<string, DayOfWeek[]>;
  members: FamilyMember[];
}) {
  if (planSplit.size === 0) return null;

  return (
    <View style={styles.planSplitCard}>
      <View style={styles.planSplitHeader}>
        <Feather name="navigation" size={13} color={TEAL} />
        <Text style={styles.planSplitTitle}>Who's covering what</Text>
      </View>
      {Array.from(planSplit.entries()).map(([driverId, days]) => {
        const driver = members.find((m) => m.id === driverId);
        if (!driver) return null;
        return (
          <View key={driverId} style={styles.planSplitRow}>
            <View style={[styles.planSplitDot, { backgroundColor: driver.color }]} />
            <Text style={styles.planSplitName}>{driver.name}</Text>
            <View style={styles.planSplitDays}>
              {days.map((d) => (
                <View
                  key={d}
                  style={[
                    styles.planSplitDayChip,
                    { borderColor: driver.color + "44", backgroundColor: driver.color + "14" },
                  ]}
                >
                  <Text style={[styles.planSplitDayText, { color: driver.color }]}>
                    {DAY_ABBR[d]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── InsightsSection ────────────────────────────────────────────────────────────
function InsightsSection({ insights }: { insights: FamilyInsight[] }) {
  if (insights.length === 0) return null;

  const iconMap: Record<string, string> = {
    conflict:    "alert-triangle",
    child_clash: "alert-circle",
    tight:       "clock",
    busy:        "layers",
    solo:        "user",
  };
  const colorMap: Record<string, string> = {
    conflict:    "#C0392B",
    child_clash: "#C0392B",
    tight:       ORANGE,
    busy:        GOLD,
    solo:        PLUM,
  };

  return (
    <View style={styles.insightsCard}>
      <View style={styles.insightsHeader}>
        <Feather name="zap" size={13} color={ORANGE} />
        <Text style={styles.insightsTitle}>Worth knowing</Text>
      </View>
      {insights.map((ins, i) => (
        <View key={i} style={styles.insightRow}>
          <Feather
            name={(iconMap[ins.type] ?? "info") as any}
            size={13}
            color={colorMap[ins.type] ?? TEXT_MUTED}
          />
          <Text style={styles.insightText}>{ins.message}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Light insight (always-on "worth knowing" for quiet weeks) ─────────────────
function getLightInsight(result: FamilyWeekResult): string | null {
  if (result.weekSummary.totalEvents === 0) return null;
  if (result.insights.length > 0) return null; // real insights take precedence
  const { totalEvents, weekendCount, busynessLevel } = result.weekSummary;
  if (totalEvents === 1) return "One event only. Nothing to worry about.";
  if (weekendCount >= 2 && busynessLevel === "quiet") return "Weekend looks busy. Nothing clashing though.";
  if (weekendCount === 1 && busynessLevel === "quiet") return "One thing this weekend. Should sort itself.";
  if (busynessLevel === "quiet") return "Two things on. Nothing that doesn't fit.";
  if (busynessLevel === "steady" && weekendCount === 0) return "Everything fits neatly this week.";
  if (busynessLevel === "steady") return "A steady week with nothing clashing.";
  if (busynessLevel === "busy") return "A full week — but it's all in one place now.";
  return "Everything currently fits.";
}

// ── SavedBanner ────────────────────────────────────────────────────────────────
type BannerType = "first" | "subsequent" | "edited";

function SavedBanner({
  type,
  eventTitle,
  onReview,
  onAddAnother,
  onDismiss,
}: {
  type: BannerType;
  eventTitle: string;
  onReview: () => void;
  onAddAnother: () => void;
  onDismiss: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(translateY,  { toValue: 0, tension: 90, friction: 14, useNativeDriver: true }),
    ]).start();
  }, []);

  const headline =
    type === "first"      ? "Saved. One thing down."
    : type === "edited"   ? "Updated."
    : "Saved. Plan updated.";

  const reviewLabel =
    type === "first" ? "Review week" : "Review full plan";

  const subline =
    type === "first"
      ? "Want us to map the week?"
      : type === "edited"
      ? "The plan reflects your change."
      : "We've sorted the week around it.";

  return (
    <Animated.View style={[styles.savedBanner, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.savedBannerLeft}>
        <View style={styles.savedBannerDot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.savedBannerHeadline}>{headline}</Text>
          <Text style={styles.savedBannerSub}>{subline}</Text>
        </View>
      </View>
      <View style={styles.savedBannerActions}>
        {type !== "edited" && (
          <TouchableOpacity style={styles.bannerReviewBtn} onPress={onReview} activeOpacity={0.85}>
            <Text style={styles.bannerReviewBtnText}>{reviewLabel}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.bannerAddBtn} onPress={onAddAnother} activeOpacity={0.85}>
          <Feather name="plus" size={13} color={TEAL} />
          <Text style={styles.bannerAddBtnText}>Add another</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={14} color={TEXT_MUTED} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── ReviewPlanCta ──────────────────────────────────────────────────────────────
function ReviewPlanCta({
  hasInsights,
  onShare,
  onAddAnother,
}: {
  hasInsights: boolean;
  onShare: () => void;
  onAddAnother: () => void;
}) {
  return (
    <View style={styles.reviewCtaCard}>
      <View style={styles.reviewCtaIcon}>
        <Feather name="check-circle" size={16} color={TEAL} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.reviewCtaTitle}>
          {hasInsights ? "Plan has a few things to note." : "The week looks sorted."}
        </Text>
        <Text style={styles.reviewCtaSub}>
          {hasInsights
            ? "See the 'Worth knowing' cards above for details."
            : "Nothing clashing. Share it when you're ready."}
        </Text>
      </View>
      <View style={styles.reviewCtaActions}>
        <TouchableOpacity style={styles.reviewCtaShareBtn} onPress={onShare} activeOpacity={0.85}>
          <Feather name="send" size={13} color="#fff" />
          <Text style={styles.reviewCtaShareBtnText}>Share plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reviewCtaAddBtn} onPress={onAddAnother} activeOpacity={0.8}>
          <Feather name="plus" size={13} color={TEAL} />
          <Text style={styles.reviewCtaAddBtnText}>Add more</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── EventCard ──────────────────────────────────────────────────────────────────
function EventCard({
  event, members, onEdit, onDelete,
}: {
  event: FamilyEvent;
  members: FamilyMember[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const driver   = event.driverId ? members.find((m) => m.id === event.driverId) : null;
  const involved = event.personIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as FamilyMember[];
  const timeLabel = formatTime(event.time);
  const endLabel  = event.endTime ? `–${formatTime(event.endTime)}` : "";

  return (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.85}
    >
      <View style={styles.eventCardMain}>
        <View style={styles.eventTimePill}>
          <Text style={styles.eventTimeText}>{timeLabel}</Text>
          {endLabel ? <Text style={styles.eventTimeEnd}> {endLabel}</Text> : null}
        </View>
        <View style={styles.eventCardBody}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <View style={styles.eventMeta}>
            {event.location ? (
              <View style={styles.eventMetaItem}>
                <Feather name="map-pin" size={11} color={TEXT_MUTED} />
                <Text style={styles.eventMetaText}>{event.location}</Text>
              </View>
            ) : null}
            {driver ? (
              <View style={styles.eventMetaItem}>
                <Feather name="navigation" size={11} color={TEAL} />
                <Text style={[styles.eventMetaText, { color: TEAL }]}>{driver.name}</Text>
              </View>
            ) : null}
            {event.repeat !== "none" ? (
              <View style={styles.eventMetaItem}>
                <Feather name="repeat" size={11} color={TEXT_MUTED} />
                <Text style={styles.eventMetaText}>{REPEAT_LABELS[event.repeat]}</Text>
              </View>
            ) : null}
          </View>
          {involved.length > 0 && (
            <View style={styles.eventInvolvedRow}>
              {involved.map((m) => (
                <MemberChip key={m.id} member={m} small />
              ))}
            </View>
          )}
        </View>
      </View>

      {expanded && (
        <View style={styles.eventActions}>
          {event.carpoolContact ? (
            <Text style={styles.carpoolText}>Carpool: {event.carpoolContact}</Text>
          ) : null}
          {event.notes ? (
            <Text style={styles.eventNotes}>{event.notes}</Text>
          ) : null}
          <View style={styles.eventActionBtns}>
            <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.8}>
              <Feather name="edit-2" size={13} color={TEAL} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
              <Feather name="trash-2" size={13} color="#C0392B" />
              <Text style={styles.deleteBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── DaySection ─────────────────────────────────────────────────────────────────
function DaySection({
  day, events, members, onEditEvent, onDeleteEvent,
}: {
  day: DayOfWeek;
  events: FamilyEvent[];
  members: FamilyMember[];
  onEditEvent: (e: FamilyEvent) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const isWeekend = day === "Saturday" || day === "Sunday";
  return (
    <View style={styles.daySection}>
      <View style={[styles.dayHeader, isWeekend && styles.dayHeaderWeekend]}>
        <Text style={[styles.dayLabel, isWeekend && { color: GOLD }]}>{day}</Text>
        <View style={[styles.eventCountBadge, isWeekend && { backgroundColor: GOLD + "18" }]}>
          <Text style={[styles.eventCountText, isWeekend && { color: GOLD }]}>
            {events.length}
          </Text>
        </View>
      </View>
      <View style={styles.daySectionEvents}>
        {events.map((ev) => (
          <EventCard
            key={ev.id}
            event={ev}
            members={members}
            onEdit={() => onEditEvent(ev)}
            onDelete={() => onDeleteEvent(ev.id)}
          />
        ))}
      </View>
    </View>
  );
}

// ── AddEventSheet ──────────────────────────────────────────────────────────────
function AddEventSheet({
  visible,
  members,
  initialDraft,
  onClose,
  onSave,
}: {
  visible: boolean;
  members: FamilyMember[];
  initialDraft?: Partial<FamilyEvent> | null;
  onClose: () => void;
  onSave: (draft: Omit<FamilyEvent, "id">) => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(600)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;

  const [draft, setDraft] = useState<Omit<FamilyEvent, "id">>(blankDraft);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setDraft(initialDraft ? { ...blankDraft(), ...initialDraft } : blankDraft());
      setErrors([]);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(overlayOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOp, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function setField<K extends keyof typeof draft>(key: K, val: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function togglePerson(id: string) {
    setDraft((d) => ({
      ...d,
      personIds: d.personIds.includes(id)
        ? d.personIds.filter((x) => x !== id)
        : [...d.personIds, id],
    }));
  }

  function handleSave() {
    const errs: string[] = [];
    if (!draft.title.trim()) errs.push("Add a title for this event.");
    if (!draft.time.trim())  errs.push("Add a start time (e.g. 3:30pm).");
    const parsedTime = draft.time.trim() ? parseTime(draft.time) : "";
    if (draft.time.trim() && !parsedTime) errs.push("Time not recognised — try 3:30pm or 15:30.");
    if (errs.length) { setErrors(errs); return; }

    const parsedEnd = draft.endTime?.trim() ? parseTime(draft.endTime) : undefined;
    onSave({
      ...draft,
      title: draft.title.trim(),
      time: parsedTime,
      endTime: parsedEnd || undefined,
      location: draft.location?.trim() || undefined,
      carpoolContact: draft.carpoolContact?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
    });
  }

  const adults = members.filter((m) => m.role === "adult");

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOp }]}>
        <Pressable style={styles.formOverlay} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.formSheet,
          { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetTitleRow}>
          <Text style={styles.sheetTitle}>
            {initialDraft?.id ? "Edit event" : "Add event"}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 18, paddingBottom: 16 }}
          >
            {errors.length > 0 && (
              <View style={styles.errorBox}>
                {errors.map((e, i) => <Text key={i} style={styles.errorText}>{e}</Text>)}
              </View>
            )}

            {/* Title */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>What's on?</Text>
              <TextInput
                style={styles.formInput}
                value={draft.title}
                onChangeText={(v) => setField("title", v)}
                placeholder="Football practice, dentist, birthday party…"
                placeholderTextColor="#bbb"
                returnKeyType="next"
              />
            </View>

            {/* Day */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Which day?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {ALL_DAYS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, draft.day === d && styles.dayChipSelected]}
                      onPress={() => setField("day", d)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.dayChipText, draft.day === d && styles.dayChipTextSelected]}>
                        {DAY_ABBR[d]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Times */}
            <View style={styles.formRow}>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.formLabel}>Start time</Text>
                <TextInput
                  style={styles.formInput}
                  value={draft.time}
                  onChangeText={(v) => setField("time", v)}
                  placeholder="e.g. 3:30pm"
                  placeholderTextColor="#bbb"
                  autoCapitalize="none"
                />
              </View>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.formLabel}>End time (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={draft.endTime ?? ""}
                  onChangeText={(v) => setField("endTime", v)}
                  placeholder="e.g. 5pm"
                  placeholderTextColor="#bbb"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Location */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Location (optional)</Text>
              <TextInput
                style={styles.formInput}
                value={draft.location ?? ""}
                onChangeText={(v) => setField("location", v)}
                placeholder="e.g. Memorial Park, Highbury Fields"
                placeholderTextColor="#bbb"
              />
            </View>

            {/* Who's involved */}
            {members.length > 0 && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Who's involved?</Text>
                <View style={styles.chipGroup}>
                  {members.map((m) => (
                    <MemberChip
                      key={m.id}
                      member={m}
                      selected={draft.personIds.includes(m.id)}
                      onPress={() => togglePerson(m.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Driver (adults only) */}
            {adults.length > 0 && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Who's driving?</Text>
                <View style={styles.chipGroup}>
                  <TouchableOpacity
                    style={[styles.driverChip, !draft.driverId && styles.driverChipNone]}
                    onPress={() => setField("driverId", undefined)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.driverChipText, !draft.driverId && styles.driverChipTextNone]}>
                      No driver
                    </Text>
                  </TouchableOpacity>
                  {adults.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.driverChip,
                        draft.driverId === m.id && {
                          backgroundColor: m.color,
                          borderColor: m.color,
                        },
                      ]}
                      onPress={() =>
                        setField("driverId", draft.driverId === m.id ? undefined : m.id)
                      }
                      activeOpacity={0.75}
                    >
                      <Feather
                        name="navigation"
                        size={12}
                        color={draft.driverId === m.id ? "#fff" : m.color}
                      />
                      <Text
                        style={[
                          styles.driverChipText,
                          draft.driverId === m.id && { color: "#fff" },
                        ]}
                      >
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Carpool contact — only when driver set */}
            {draft.driverId && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Carpool contact (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={draft.carpoolContact ?? ""}
                  onChangeText={(v) => setField("carpoolContact", v)}
                  placeholder="Name or phone number"
                  placeholderTextColor="#bbb"
                />
              </View>
            )}

            {/* Repeat */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Does this repeat?</Text>
              <View style={styles.chipGroup}>
                {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.repeatChip, draft.repeat === r && styles.repeatChipSelected]}
                    onPress={() => setField("repeat", r)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.repeatChipText,
                        draft.repeat === r && styles.repeatChipTextSelected,
                      ]}
                    >
                      {REPEAT_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={draft.notes ?? ""}
                onChangeText={(v) => setField("notes", v)}
                placeholder="Anything else worth knowing…"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>Save event</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── ManagePeopleSection ────────────────────────────────────────────────────────
function ManagePeopleSection({
  members, onAdd, onRemove,
}: {
  members: FamilyMember[];
  onAdd: (name: string, role: "adult" | "child") => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName]     = useState("");
  const [role, setRole]     = useState<"adult" | "child">("child");

  function confirm() {
    if (!name.trim()) return;
    onAdd(name.trim(), role);
    setName(""); setRole("child"); setAdding(false);
    Keyboard.dismiss();
  }

  return (
    <View style={styles.peopleSection}>
      <View style={styles.peopleSectionHeader}>
        <Feather name="users" size={14} color={TEXT_MUTED} />
        <Text style={styles.peopleSectionTitle}>Family members</Text>
      </View>

      {members.length === 0 && !adding && (
        <Text style={styles.peopleSectionEmpty}>
          Add family members to assign them to events.
        </Text>
      )}

      {members.length > 0 && (
        <View style={styles.peopleList}>
          {members.map((m) => (
            <View key={m.id} style={styles.peopleRow}>
              <View style={[styles.peopleColorDot, { backgroundColor: m.color }]} />
              <Text style={styles.peopleName}>{m.name}</Text>
              <View style={[styles.roleTag, m.role === "adult" ? styles.roleTagAdult : styles.roleTagChild]}>
                <Text style={[styles.roleTagText, { color: m.role === "adult" ? TEAL : GOLD }]}>
                  {m.role === "adult" ? "Adult" : "Child"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onRemove(m.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={14} color="#ccc" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {adding ? (
        <View style={styles.addPersonForm}>
          <TextInput
            style={styles.addPersonInput}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#bbb"
            returnKeyType="done"
            onSubmitEditing={confirm}
            autoFocus
          />
          <View style={styles.addPersonRoleRow}>
            {(["adult", "child"] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.addPersonRole, role === r && styles.addPersonRoleSelected]}
                onPress={() => setRole(r)}
                activeOpacity={0.75}
              >
                <Text style={[styles.addPersonRoleText, role === r && { color: TEAL }]}>
                  {r === "adult" ? "Adult" : "Child"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.addPersonBtns}>
            <TouchableOpacity style={styles.addPersonConfirm} onPress={confirm} activeOpacity={0.8}>
              <Feather name="check" size={14} color="#fff" />
              <Text style={styles.addPersonConfirmText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAdding(false)} activeOpacity={0.7}>
              <Feather name="x" size={16} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addPersonCta}
          onPress={() => setAdding(true)}
          activeOpacity={0.75}
        >
          <Feather name="user-plus" size={13} color={TEAL} />
          <Text style={styles.addPersonCtaText}>Add person</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function FamilyScreen() {
  const insets        = useSafeAreaInsets();
  const paddingTop    = insets.top + 8;
  const paddingBottom = insets.bottom + 88;
  const scrollRef     = useRef<ScrollView>(null);
  const bannerTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState]   = useState<FamilyState>({ members: [], events: [] });
  const [result, setResult] = useState<FamilyWeekResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedBanner, setSavedBanner] = useState<{
    type: BannerType; title: string;
  } | null>(null);

  const [showForm, setShowForm]       = useState(false);
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null);

  const load = useCallback(async () => {
    const s = await loadFamilyState();
    setState(s);
    setResult(computeFamilyWeek(s));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

  async function persistState(next: FamilyState) {
    setState(next);
    setResult(computeFamilyWeek(next));
    await saveFamilyState(next);
  }

  function openAddEvent()                   { setEditingEvent(null); setShowForm(true); }
  function openEditEvent(ev: FamilyEvent)   { setEditingEvent(ev);   setShowForm(true); }

  function showBanner(type: BannerType, title: string) {
    setSavedBanner({ type, title });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setSavedBanner(null), 6000);
    // Scroll to top so the banner and summary are visible
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 80);
  }

  function dismissBanner() {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setSavedBanner(null);
  }

  async function handleSaveEvent(draft: Omit<FamilyEvent, "id">) {
    const wasEditing  = !!editingEvent;
    const prevCount   = state.events.length;
    const next: FamilyState = editingEvent
      ? {
          ...state,
          events: state.events.map((e) =>
            e.id === editingEvent.id ? { ...draft, id: editingEvent.id } : e
          ),
        }
      : { ...state, events: [...state.events, { ...draft, id: Date.now().toString() }] };
    setShowForm(false);
    setEditingEvent(null);
    await persistState(next);
    const bannerType: BannerType =
      wasEditing ? "edited" : prevCount === 0 ? "first" : "subsequent";
    showBanner(bannerType, draft.title);
  }

  async function handleDeleteEvent(id: string) {
    Alert.alert("Remove event?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await persistState({ ...state, events: state.events.filter((e) => e.id !== id) });
        },
      },
    ]);
  }

  async function handleAddMember(name: string, role: "adult" | "child") {
    const usedColors = state.members.map((m) => m.color);
    const color = MEMBER_COLORS.find((c) => !usedColors.includes(c)) ?? MEMBER_COLORS[0]!;
    const member: FamilyMember = { id: Date.now().toString(), name, role, color };
    await persistState({ ...state, members: [...state.members, member] });
  }

  async function handleRemoveMember(id: string) {
    await persistState({
      members: state.members.filter((m) => m.id !== id),
      events: state.events.map((e) => ({
        ...e,
        personIds: e.personIds.filter((pid) => pid !== id),
        driverId: e.driverId === id ? undefined : e.driverId,
      })),
    });
  }

  async function handleSharePlan() {
    if (!result) return;
    try { await Share.share({ message: result.sharePlanText }); } catch {}
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: BG }} />;

  const hasEvents      = state.events.length > 0;
  const hasMembers     = state.members.length > 0;
  const insights       = result?.insights ?? [];
  const weekSummary    = result?.weekSummary;
  const planSplit      = result?.planSplit ?? new Map();
  const daysWithEvents = result?.daysWithEvents ?? [];
  const lightInsight   = result ? getLightInsight(result) : null;
  const hasInsights    = insights.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Family</Text>
            <Text style={styles.pageSub}>
              {hasEvents
                ? (result?.dashboardLine ?? "The moving parts of your week.")
                : hasMembers
                ? "Once you add a couple of things, we'll map the week."
                : "Your family's week, in one place."}
            </Text>
          </View>
        </View>

        {/* ── Post-save confirmation banner ── */}
        {savedBanner && (
          <SavedBanner
            type={savedBanner.type}
            eventTitle={savedBanner.title}
            onReview={() => { dismissBanner(); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
            onAddAnother={() => { dismissBanner(); openAddEvent(); }}
            onDismiss={dismissBanner}
          />
        )}

        {/* ══ PLANNER OUTPUTS — lead when events exist ══ */}
        {hasEvents ? (
          <>
            {/* 1. Week summary stats */}
            {weekSummary && <WeekSummaryCard summary={weekSummary} />}

            {/* 2. Worth knowing — always shows something */}
            {hasInsights ? (
              <InsightsSection insights={insights} />
            ) : lightInsight ? (
              <View style={styles.lightInsightCard}>
                <Feather name="zap" size={13} color={TEAL} />
                <Text style={styles.lightInsightText}>{lightInsight}</Text>
              </View>
            ) : null}

            {/* 3. Who's covering what — up here, not buried */}
            {planSplit.size > 0 && (
              <PlanSplitSection planSplit={planSplit} members={state.members} />
            )}

            {/* 4. This week — day-by-day events */}
            <View style={styles.weekSection}>
              <Text style={styles.sectionLabel}>THIS WEEK</Text>
              {daysWithEvents.map((day) => (
                <DaySection
                  key={day}
                  day={day}
                  events={result?.eventsByDay[day] ?? []}
                  members={state.members}
                  onEditEvent={openEditEvent}
                  onDeleteEvent={handleDeleteEvent}
                />
              ))}
            </View>

            {/* 5. Review / share CTA */}
            <ReviewPlanCta
              hasInsights={hasInsights}
              onShare={handleSharePlan}
              onAddAnother={openAddEvent}
            />
          </>
        ) : hasMembers ? (
          /* ── Members exist, no events ── */
          <View style={styles.membersReadyState}>
            <View style={styles.membersReadyChips}>
              {state.members.map((m) => (
                <MemberChip key={m.id} member={m} />
              ))}
            </View>
            <Text style={styles.membersReadyTitle}>Everyone's here.</Text>
            <Text style={styles.membersReadySub}>
              Add events as they come up — pickups, activities, anything that needs coordinating.
              Once you do, we'll map the week for you.
            </Text>
            <TouchableOpacity
              style={styles.membersReadyCta}
              onPress={openAddEvent}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.membersReadyCtaText}>Add first event</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Truly empty ── */
          <View style={styles.emptyState}>
            <Feather name="calendar" size={34} color="#D6D2C8" />
            <Text style={styles.emptyTitle}>Nothing on this week.</Text>
            <Text style={styles.emptySub}>
              Add family members, then events as they come up. Sortii will sort the week.
            </Text>
          </View>
        )}

        {/* ── Family members (always at bottom when events exist) ── */}
        <ManagePeopleSection
          members={state.members}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
        />

        {/* ── Recurring events note ── */}
        {state.events.some((e) => e.repeat !== "none") && (
          <View style={styles.repeatNote}>
            <Feather name="repeat" size={12} color={TEXT_MUTED} />
            <Text style={styles.repeatNoteText}>
              Repeating events carry forward automatically each week.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Floating add button ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: paddingBottom - 48 }]}
        onPress={openAddEvent}
        activeOpacity={0.88}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Add event</Text>
      </TouchableOpacity>

      {/* ── Add / Edit form sheet ── */}
      {showForm && (
        <AddEventSheet
          visible={showForm}
          members={state.members}
          initialDraft={editingEvent}
          onClose={() => { setShowForm(false); setEditingEvent(null); }}
          onSave={handleSaveEvent}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 14 },

  // Header
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  pageTitle: { fontSize: 28, fontFamily: "Manrope_700Bold", color: TEXT, letterSpacing: -0.5 },
  pageSub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic",
    marginTop: 3, lineHeight: 18, maxWidth: 240,
  },
  sharePlanBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: TEAL + "30", marginTop: 4, flexShrink: 0,
  },
  sharePlanBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL },

  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2,
    textTransform: "uppercase", color: TEXT_MUTED, marginBottom: 6,
  },

  // Week summary card
  weekSummaryCard: {
    backgroundColor: TEAL_TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TEAL + "30",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  weekSummaryStats: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 14 },
  statItem: { alignItems: "center", gap: 1 },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: TEXT },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  busynessPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
  },
  busynessDot: { width: 7, height: 7, borderRadius: 4 },
  busynessText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  unassignedNote: { flexDirection: "row", alignItems: "center", gap: 6 },
  unassignedNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, flex: 1 },

  // Plan split card
  planSplitCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    padding: 14,
    gap: 10,
  },
  planSplitHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  planSplitTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  planSplitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  planSplitDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  planSplitName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT, minWidth: 56 },
  planSplitDays: { flexDirection: "row", flexWrap: "wrap", gap: 5, flex: 1 },
  planSplitDayChip: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
  },
  planSplitDayText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Insights
  insightsCard: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 3, borderLeftColor: ORANGE, padding: 14, gap: 10,
  },
  insightsHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  insightsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  insightText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 18 },

  // Week section
  weekSection: { gap: 0 },
  daySection: { marginBottom: 4 },
  dayHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 6,
  },
  dayHeaderWeekend: { borderBottomColor: GOLD + "44" },
  dayLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: TEXT, flex: 1 },
  eventCountBadge: { backgroundColor: TEAL + "18", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  eventCountText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: TEAL },
  daySectionEvents: { gap: 6, marginBottom: 12 },

  // Event card
  eventCard: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  eventCardMain: { flexDirection: "row", gap: 10, padding: 11 },
  eventTimePill: {
    backgroundColor: TEAL_TINT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    alignSelf: "flex-start", flexShrink: 0, flexDirection: "row", alignItems: "center",
  },
  eventTimeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: TEAL },
  eventTimeEnd: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEAL },
  eventCardBody: { flex: 1, gap: 4 },
  eventTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT },
  eventMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  eventMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  eventMetaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  eventInvolvedRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },
  eventActions: { borderTopWidth: 1, borderTopColor: BORDER, padding: 11, gap: 8 },
  carpoolText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },
  eventNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED },
  eventActionBtns: { flexDirection: "row", gap: 10 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, padding: 6 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 5, padding: 6 },
  deleteBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#C0392B" },

  // Member chip
  memberChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
  },
  memberChipSmall: { paddingHorizontal: 7, paddingVertical: 3 },
  memberChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  memberChipTextSmall: { fontSize: 11 },
  roleDot: { width: 5, height: 5, borderRadius: 3 },

  // "Members exist, no events" state
  membersReadyState: {
    backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 20, alignItems: "center", gap: 10,
  },
  membersReadyChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  membersReadyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: TEXT, marginTop: 4 },
  membersReadySub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED,
    textAlign: "center", lineHeight: 19,
  },
  membersReadyCta: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: TEAL, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, marginTop: 4,
  },
  membersReadyCtaText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Truly empty state
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: TEXT },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, textAlign: "center", lineHeight: 19 },

  // People section
  peopleSection: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 10,
  },
  peopleSectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  peopleSectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  peopleSectionEmpty: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },
  peopleList: { gap: 8 },
  peopleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  peopleColorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  peopleName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: TEXT },
  roleTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  roleTagAdult: { backgroundColor: TEAL + "18" },
  roleTagChild: { backgroundColor: GOLD + "18" },
  roleTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  addPersonForm: { gap: 10 },
  addPersonInput: {
    backgroundColor: "#F7F3EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, borderWidth: 1, borderColor: BORDER,
  },
  addPersonRoleRow: { flexDirection: "row", gap: 8 },
  addPersonRole: {
    flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, backgroundColor: BG,
  },
  addPersonRoleSelected: { borderColor: TEAL, backgroundColor: TEAL_TINT },
  addPersonRoleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  addPersonBtns: { flexDirection: "row", alignItems: "center", gap: 10 },
  addPersonConfirm: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: TEAL, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  addPersonConfirmText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  addPersonCta: { flexDirection: "row", alignItems: "center", gap: 7 },
  addPersonCtaText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Saved banner
  savedBanner: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: TEAL + "40", borderLeftWidth: 3, borderLeftColor: TEAL,
    padding: 14, gap: 10,
    ...Platform.select({
      web: { boxShadow: `0px 2px 12px ${TEAL}22` },
      default: { shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 },
    }),
  },
  savedBannerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  savedBannerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: TEAL, marginTop: 4, flexShrink: 0 },
  savedBannerHeadline: { fontSize: 14, fontFamily: "Inter_700Bold", color: TEXT },
  savedBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, marginTop: 1 },
  savedBannerActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  bannerReviewBtn: {
    backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  bannerReviewBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  bannerAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: TEAL + "30",
  },
  bannerAddBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Light insight (quiet week)
  lightInsightCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    backgroundColor: TEAL_TINT, borderRadius: 12, borderWidth: 1, borderColor: TEAL + "30",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  lightInsightText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT, lineHeight: 18 },

  // Review plan CTA
  reviewCtaCard: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 10,
  },
  reviewCtaIcon: { marginBottom: 2 },
  reviewCtaTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT },
  reviewCtaSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT_MUTED, lineHeight: 18 },
  reviewCtaActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  reviewCtaShareBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  reviewCtaShareBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  reviewCtaAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: TEAL_TINT, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: TEAL + "30",
  },
  reviewCtaAddBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEAL },

  // Repeat note
  repeatNote: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  repeatNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", color: TEXT_MUTED, fontStyle: "italic" },

  // FAB
  fab: {
    position: "absolute", right: 20,
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: TEAL, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13,
    ...Platform.select({
      web: { boxShadow: `0px 4px 16px ${TEAL}55` },
      default: {
        shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
      },
    }),
  },
  fabText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Form sheet
  formOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  formSheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%",
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    ...Platform.select({
      web: { boxShadow: "0px -6px 30px rgba(0,0,0,0.14)" },
      default: {
        shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.14, shadowRadius: 20, elevation: 24,
      },
    }),
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 14 },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: TEXT },

  // Form fields
  formField: { gap: 7 },
  formRow: { flexDirection: "row", gap: 12 },
  formLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED,
    textTransform: "uppercase", letterSpacing: 0.7,
  },
  formInput: {
    backgroundColor: "#F7F3EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, borderWidth: 1, borderColor: BORDER,
  },
  formTextArea: { minHeight: 76 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: BG },
  dayChipSelected: { backgroundColor: TEAL, borderColor: TEAL },
  dayChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT_MUTED },
  dayChipTextSelected: { color: "#fff" },
  driverChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: BG,
  },
  driverChipNone: { backgroundColor: "#F0F0F0", borderColor: "#E0E0E0" },
  driverChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED },
  driverChipTextNone: { color: TEXT },
  repeatChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: BG },
  repeatChipSelected: { backgroundColor: TEAL_TINT, borderColor: TEAL },
  repeatChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: TEXT_MUTED },
  repeatChipTextSelected: { color: TEAL },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 10, borderWidth: 1, borderColor: "#FCA5A5", padding: 12, gap: 4 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#B91C1C" },
  saveBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
