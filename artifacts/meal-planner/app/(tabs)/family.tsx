import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";
const PLUM_TINT = "#F3E8EE";
const BG = "#F7F3EB";
const CARD_BG = "#FFFFFF";
const BORDER = "#E6E1D7";
const TEXT = "#2B2B2B";
const TEXT_MUTED = "#888888";

interface Section {
  key: string;
  icon: string;
  color: string;
  title: string;
  emptyLine: string;
  ctaLabel: string;
}

const SECTIONS: Section[] = [
  {
    key: "kids",
    icon: "star",
    color: GOLD,
    title: "Kids & activities",
    emptyLine: "Nothing on yet. Enjoy the quiet.",
    ctaLabel: "Add activity",
  },
  {
    key: "pickups",
    icon: "map-pin",
    color: TEAL,
    title: "Pickups & dropoffs",
    emptyLine: "All clear here. Nobody needs to be anywhere.",
    ctaLabel: "Add pickup",
  },
  {
    key: "weekend",
    icon: "sun",
    color: "#E07B3A",
    title: "Weekend plans",
    emptyLine: "A rare and peaceful sight. Nothing added yet.",
    ctaLabel: "Add plan",
  },
  {
    key: "notes",
    icon: "edit-3",
    color: PLUM,
    title: "Family notes",
    emptyLine: "Nothing to remember right now. That's fine.",
    ctaLabel: "Add note",
  },
];

function SectionCard({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View style={[styles.sectionIconWrap, { backgroundColor: section.color + "18" }]}>
          <Feather name={section.icon as any} size={16} color={section.color} />
        </View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={TEXT_MUTED}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sectionBody}>
          <Text style={styles.emptyLine}>{section.emptyLine}</Text>
          <TouchableOpacity style={styles.ctaRow} activeOpacity={0.7}>
            <Feather name="plus" size={13} color={section.color} />
            <Text style={[styles.ctaLabel, { color: section.color }]}>
              {section.ctaLabel}
            </Text>
            <View style={styles.comingSoonPill}>
              <Text style={styles.comingSoonText}>Coming soon</Text>
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
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Family</Text>
          <Text style={styles.pageSubtitle}>
            The moving parts of your week, in one place.
          </Text>
        </View>

        {/* Coming soon banner */}
        <View style={styles.comingBanner}>
          <Feather name="users" size={18} color={PLUM} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.comingBannerTitle}>Module in progress</Text>
            <Text style={styles.comingBannerBody}>
              Family logistics, kids' activities, and household coordination —
              all coming to Sortii soon.
            </Text>
          </View>
        </View>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <SectionCard key={section.key} section={section} />
        ))}

        <View style={{ paddingBottom: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },

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

  comingBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: PLUM_TINT,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: PLUM + "40",
    borderLeftColor: PLUM,
    padding: 14,
  },
  comingBannerTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: PLUM,
  },
  comingBannerBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: PLUM,
    lineHeight: 19,
    opacity: 0.85,
  },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
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
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ctaLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  comingSoonPill: {
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#999",
  },
});
