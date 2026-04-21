import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";

export const unstable_settings = {
  initialRouteName: "home",
};

let _sessionInitialized = false;

const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";
const GREEN = "#2A8F88";

// ── Quick Add sheet ─────────────────────────────────────────────
function QuickAddSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const options = [
    {
      icon: "calendar",
      color: TEAL,
      label: "Add meal",
      sub: "Plan dinner or lunch for a day",
      onPress: () => {
        onClose();
        router.push("/(tabs)/planner");
      },
    },
    {
      icon: "star",
      color: GOLD,
      label: "Add family activity",
      sub: "Kids, pickups, weekend plans",
      onPress: () => {
        onClose();
        router.push("/(tabs)/family");
      },
    },
    {
      icon: "clock",
      color: PLUM,
      label: "Add appointment",
      sub: "Doctors, school, anything",
      onPress: () => {
        onClose();
        router.push("/(tabs)/appointments");
      },
    },
    {
      icon: "file-text",
      color: GREEN,
      label: "Add bill",
      sub: "Track what's coming up",
      onPress: () => {
        onClose();
        router.push("/(tabs)/bills");
      },
    },
  ];

  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}
        onPress={(e) => e.stopPropagation()}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>What do you need?</Text>
        <Text style={styles.sheetSub}>Add something or get somewhere fast.</Text>

        <View style={styles.sheetOptions}>
          {options.map(({ icon, color, label, sub, onPress }) => (
            <TouchableOpacity
              key={label}
              style={styles.sheetOption}
              onPress={onPress}
              activeOpacity={0.72}
            >
              <View
                style={[
                  styles.sheetOptionIcon,
                  { backgroundColor: color + "18" },
                ]}
              >
                <Feather name={icon as any} size={17} color={color} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionLabel}>{label}</Text>
                <Text style={styles.sheetOptionSub}>{sub}</Text>
              </View>
              <Feather name="chevron-right" size={15} color="#D8D8D8" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sheetNavLinks}>
          <TouchableOpacity
            style={styles.sheetNavLink}
            onPress={() => { onClose(); router.push("/(tabs)/appointments"); }}
            activeOpacity={0.7}
          >
            <Text style={styles.sheetNavLinkText}>Go to Appointments →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetNavLink}
            onPress={() => { onClose(); router.push("/(tabs)/bills"); }}
            activeOpacity={0.7}
          >
            <Text style={styles.sheetNavLinkText}>Go to Bills →</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.sheetCancel} onPress={onClose}>
          <Text style={styles.sheetCancelText}>Cancel</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  );
}

// ── Add tab button ──────────────────────────────────────────────
function AddTabButton({
  style,
  onPress,
}: {
  style?: any;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "ios"
    ? Math.max(insets.bottom + 2, 10)
    : Platform.OS === "web" ? 9 : 5;

  return (
    <TouchableOpacity
      style={[
        style,
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: bottomPad,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.82}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: GOLD,
          alignItems: "center",
          justifyContent: "center",
          ...Platform.select({
            web: { boxShadow: `0px 2px 6px ${GOLD}38` },
            default: {
              shadowColor: GOLD,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.18,
              shadowRadius: 5,
              elevation: 3,
            },
          }),
        }}
      >
        <Feather name="plus" size={17} color="#fff" />
      </View>
      <Text
        style={{
          fontSize: 10,
          color: GOLD,
          fontFamily: "Inter_500Medium",
          marginTop: 3,
          letterSpacing: 0.1,
        }}
      >
        More
      </Text>
    </TouchableOpacity>
  );
}

// ── Tab layout ──────────────────────────────────────────────────
export default function TabLayout() {
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    if (!_sessionInitialized) {
      _sessionInitialized = true;
      router.replace("/(tabs)/home");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const C = Colors.light;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          tabBarActiveTintColor: C.primary,
          tabBarInactiveTintColor: "#ABABAB",
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? "#2A2A2A" : "#E4E0DA",
            elevation: 0,
            height: Platform.OS === "web" ? 72 : undefined,
          },
          tabBarItemStyle: {
            paddingBottom: Platform.OS === "web" ? 6 : 2,
            paddingTop: Platform.OS === "web" ? 4 : 2,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: "Inter_500Medium",
            letterSpacing: 0.1,
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={90}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: isDark ? "#000" : "#fff" },
                ]}
              />
            ),
        }}
      >
        {/* ── Visible tabs ── */}
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={21}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="meals"
          options={{
            title: "Meals",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "restaurant" : "restaurant-outline"}
                size={21}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: "",
            tabBarButton: (props) => (
              <AddTabButton
                style={props.style}
                onPress={() => setQuickAddVisible(true)}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: "Family",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "people" : "people-outline"}
                size={21}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="money"
          options={{
            title: "Money",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "wallet" : "wallet-outline"}
                size={21}
                color={color}
              />
            ),
            tabBarActiveTintColor: "#D29A22",
          }}
        />
        {/* ── Hidden (still accessible via router.push) ── */}
        <Tabs.Screen name="bills"        options={{ href: null }} />
        <Tabs.Screen name="planner"      options={{ href: null }} />
        <Tabs.Screen name="recipes"      options={{ href: null }} />
        <Tabs.Screen name="refresh"      options={{ href: null }} />
        <Tabs.Screen name="shopping"     options={{ href: null }} />
        <Tabs.Screen name="more"         options={{ href: null }} />
        <Tabs.Screen name="saved"        options={{ href: null }} />
        <Tabs.Screen name="preferences"  options={{ href: null }} />
        <Tabs.Screen name="appointments" options={{ href: null }} />
        <Tabs.Screen name="upcoming"     options={{ href: null }} />
        <Tabs.Screen name="index"           options={{ href: null }} />
        <Tabs.Screen name="household-profile" options={{ href: null }} />
      </Tabs>

      {/* Quick Add overlay — rendered above the tab bar */}
      <QuickAddSheet
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    zIndex: 999,
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 20,
    ...Platform.select({
      web: { boxShadow: "0px -3px 20px rgba(0,0,0,0.10)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.10,
        shadowRadius: 14,
        elevation: 20,
      },
    }),
  },
  sheetHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#DEDAD4",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#2B2B2B",
    marginBottom: 3,
  },
  sheetSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#AAA",
    marginBottom: 18,
  },
  sheetOptions: { gap: 2 },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0EDE8",
  },
  sheetOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOptionText: { flex: 1, gap: 2 },
  sheetOptionLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#2B2B2B",
  },
  sheetOptionSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#ADADAD",
  },
  sheetNavLinks: {
    marginTop: 6,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F0EDE8",
    paddingTop: 10,
  },
  sheetNavLink: {
    paddingVertical: 9,
  },
  sheetNavLinkText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#2A8F88",
  },
  sheetCancel: {
    marginTop: 14,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#F5F1EB",
    borderRadius: 13,
  },
  sheetCancelText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#999",
  },
});
