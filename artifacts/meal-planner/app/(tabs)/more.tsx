import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
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
const BG = "#F7F3EB";
const CARD_BG = "#FFFFFF";
const BORDER = "#E6E1D7";
const TEXT = "#2B2B2B";
const TEXT_MUTED = "#888888";
const TEAL_TINT = "#E6F3F0";

interface ListItem {
  icon: string;
  color: string;
  label: string;
  sub?: string;
  badge?: string;
  onPress: () => void;
}

export default function MoreScreen() {
  const router = useRouter();

  const SECTIONS: { title: string; items: ListItem[] }[] = [
    {
      title: "Your setup",
      items: [
        {
          icon: "sliders",
          color: TEAL,
          label: "Preferences",
          sub: "Household, dietary, seasonal",
          onPress: () => router.push("/(tabs)/preferences"),
        },
        {
          icon: "target",
          color: GOLD,
          label: "Money setup",
          sub: "Budget, savings goal, breathing room",
          onPress: () => router.push("/money-setup"),
        },
      ],
    },
    {
      title: "Organised life",
      items: [
        {
          icon: "layers",
          color: TEAL,
          label: "What's Coming Up",
          sub: "Everything across all modules, in one place",
          onPress: () => router.push("/(tabs)/upcoming"),
        },
        {
          icon: "calendar",
          color: PLUM,
          label: "Appointments",
          sub: "Doctors, school, anything in the diary",
          onPress: () => router.push("/(tabs)/appointments"),
        },
        {
          icon: "file-text",
          color: "#4A7B5E",
          label: "Bills",
          sub: "Track what's coming up and what's paid",
          onPress: () => router.push("/(tabs)/bills"),
        },
      ],
    },
    {
      title: "Saved & history",
      items: [
        {
          icon: "bookmark",
          color: TEAL,
          label: "Saved meal plans",
          sub: "Plans you've kept for later",
          onPress: () => router.push("/(tabs)/saved"),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>More</Text>
          <Text style={styles.pageSubtitle}>Everything else, in one calm place.</Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    idx < section.items.length - 1 && styles.rowBorder,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={item.badge ? 1 : 0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.color + "18" }]}>
                    <Feather name={item.icon as any} size={17} color={item.color} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    {item.sub && <Text style={styles.rowSub}>{item.sub}</Text>}
                  </View>
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={16} color="#ccc" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>
            sorti<Text style={styles.footerGold}>ii</Text>.
          </Text>
          <Text style={styles.footerSub}>Your week, sorted.</Text>
        </View>

        <View style={{ paddingBottom: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 20 },

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

  section: { gap: 8 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    color: TEXT_MUTED,
  },
  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 1 },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
  },
  badge: {
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#999",
  },

  footer: { alignItems: "center", paddingTop: 8, gap: 2 },
  footerBrand: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    color: TEXT,
  },
  footerGold: { color: GOLD },
  footerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: TEXT_MUTED,
    fontStyle: "italic",
  },
});
