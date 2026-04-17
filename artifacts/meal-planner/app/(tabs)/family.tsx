import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";
const ORANGE = "#E07B3A";
const BG = "#F7F3EB";
const CARD_BG = "#FFFFFF";
const BORDER = "#E6E1D7";
const TEXT = "#2B2B2B";
const TEXT_MUTED = "#888888";

const KIDS_KEY = "@sortii_kids_activities";

interface Activity {
  id: string;
  name: string;
}

// ── Kids & Activities section (fully live) ─────────────────────
function KidsSection() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(KIDS_KEY).then((raw) => {
      if (raw) setActivities(JSON.parse(raw));
    });
  }, []);

  async function save(updated: Activity[]) {
    setActivities(updated);
    await AsyncStorage.setItem(KIDS_KEY, JSON.stringify(updated));
  }

  function startAdding() {
    setAdding(true);
    setDraft("");
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  async function confirmAdd() {
    const name = draft.trim();
    if (!name) { setAdding(false); return; }
    const next = [...activities, { id: Date.now().toString(), name }];
    await save(next);
    setDraft("");
    setAdding(false);
  }

  async function removeActivity(id: string) {
    const next = activities.filter((a) => a.id !== id);
    await save(next);
  }

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View style={[styles.sectionIconWrap, { backgroundColor: GOLD + "18" }]}>
          <Feather name="star" size={16} color={GOLD} />
        </View>
        <Text style={styles.sectionTitle}>Kids & activities</Text>
        {activities.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{activities.length}</Text>
          </View>
        )}
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={TEXT_MUTED}
        />
      </TouchableOpacity>

      {expanded && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sectionBody}>
            {activities.length === 0 && !adding && (
              <Text style={styles.emptyLine}>
                Nothing on yet. Enjoy the quiet.
              </Text>
            )}

            {activities.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <View style={styles.activityDot} />
                <Text style={styles.activityName}>{a.name}</Text>
                <TouchableOpacity
                  onPress={() => removeActivity(a.id)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={14} color="#ccc" />
                </TouchableOpacity>
              </View>
            ))}

            {adding ? (
              <View style={styles.addRow}>
                <TextInput
                  ref={inputRef}
                  style={styles.addInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="e.g. Football practice, 4pm"
                  placeholderTextColor="#bbb"
                  returnKeyType="done"
                  onSubmitEditing={confirmAdd}
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.addConfirmBtn}
                  onPress={confirmAdd}
                  activeOpacity={0.8}
                >
                  <Feather name="check" size={15} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAdding(false)}
                  activeOpacity={0.7}
                  style={styles.addCancelBtn}
                >
                  <Feather name="x" size={15} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.ctaRow}
                onPress={startAdding}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={13} color={GOLD} />
                <Text style={[styles.ctaLabel, { color: GOLD }]}>
                  Add activity
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ── Scaffolded section (Coming soon) ──────────────────────────
interface ScaffoldedSectionProps {
  icon: string;
  color: string;
  title: string;
  emptyLine: string;
  ctaLabel: string;
}

function ScaffoldedSection({
  icon,
  color,
  title,
  emptyLine,
  ctaLabel,
}: ScaffoldedSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View style={[styles.sectionIconWrap, { backgroundColor: color + "18" }]}>
          <Feather name={icon as any} size={16} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={TEXT_MUTED}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sectionBody}>
          <Text style={styles.emptyLine}>{emptyLine}</Text>
          <TouchableOpacity style={styles.ctaRow} activeOpacity={1}>
            <Feather name="plus" size={13} color={color} />
            <Text style={[styles.ctaLabel, { color }]}>{ctaLabel}</Text>
            <View style={styles.soonPill}>
              <Text style={styles.soonText}>Coming soon</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function FamilyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Family</Text>
          <Text style={styles.pageSubtitle}>
            The moving parts of your week, in one place.
          </Text>
        </View>

        {/* Kids — fully live */}
        <KidsSection />

        {/* Pickups — scaffolded */}
        <ScaffoldedSection
          icon="map-pin"
          color={TEAL}
          title="Pickups & dropoffs"
          emptyLine="All clear here. Nobody needs to be anywhere."
          ctaLabel="Add pickup"
        />

        {/* Weekend — scaffolded */}
        <ScaffoldedSection
          icon="sun"
          color={ORANGE}
          title="Weekend plans"
          emptyLine="A rare and peaceful sight. Nothing added yet."
          ctaLabel="Add plan"
        />

        {/* Notes — scaffolded */}
        <ScaffoldedSection
          icon="edit-3"
          color={PLUM}
          title="Family notes"
          emptyLine="Nothing to remember right now. That's fine."
          ctaLabel="Add note"
        />

        <View style={{ paddingBottom: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  header: { gap: 4, marginBottom: 4 },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Manrope_700Bold",
    color: TEXT,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    marginTop: 2,
  },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
  },
  countBadge: {
    backgroundColor: GOLD + "22",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginRight: 4,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: GOLD,
  },
  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    padding: 14,
    gap: 10,
  },
  emptyLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: TEXT_MUTED,
  },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
    flexShrink: 0,
  },
  activityName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: TEXT,
  },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  addInput: {
    flex: 1,
    backgroundColor: "#F7F3EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    borderWidth: 1,
    borderColor: BORDER,
  },
  addConfirmBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  addCancelBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 2,
  },
  ctaLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  soonPill: {
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  soonText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#999",
  },
});
