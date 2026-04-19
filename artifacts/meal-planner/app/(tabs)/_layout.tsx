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

/**
 * Expo Router: declare 'home' as the canonical initial tab.
 * This is evaluated at module load time by the file-system router.
 */
export const unstable_settings = {
  initialRouteName: "home",
};

/**
 * Module-level flag — false on every fresh page load (web) or app launch (native).
 * Ensures the Home redirect fires once per session, regardless of which URL or
 * persisted route the navigator tries to restore.
 */
let _sessionInitialized = false;

const TEAL = "#2A8F88";
const GOLD = "#D29A22";
const PLUM = "#5E3A4C";
const GREEN = "#4A7B5E";

// ── Quick Add sheet ────────────────────────────────────────────
function QuickAddSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

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
    {
      icon: "edit-3",
      color: "#888",
      label: "Add note",
      sub: "Coming soon",
      disabled: true,
      onPress: () => {},
    },
  ];

  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable
        style={styles.sheet}
        onPress={(e) => e.stopPropagation()}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>What's come up?</Text>
        <Text style={styles.sheetSub}>Quick. No admin, no fuss.</Text>

        <View style={styles.sheetOptions}>
          {options.map(({ icon, color, label, sub, disabled, onPress }) => (
            <TouchableOpacity
              key={label}
              style={[styles.sheetOption, disabled && styles.sheetOptionDisabled]}
              onPress={onPress}
              activeOpacity={disabled ? 1 : 0.7}
            >
              <View
                style={[
                  styles.sheetOptionIcon,
                  { backgroundColor: color + "1A" },
                ]}
              >
                <Feather name={icon as any} size={18} color={disabled ? "#bbb" : color} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text
                  style={[
                    styles.sheetOptionLabel,
                    disabled && { color: "#bbb" },
                  ]}
                >
                  {label}
                </Text>
                <Text style={styles.sheetOptionSub}>{sub}</Text>
              </View>
              {!disabled && (
                <Feather name="chevron-right" size={16} color="#ddd" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.sheetCancel} onPress={onClose}>
          <Text style={styles.sheetCancelText}>Cancel</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  );
}

// ── Add tab button ─────────────────────────────────────────────
function AddTabButton({
  style,
  onPress,
}: {
  style?: any;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "ios"
    ? Math.max(insets.bottom + 2, 12)
    : Platform.OS === "web" ? 10 : 6;

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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      activeOpacity={0.82}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: GOLD,
          alignItems: "center",
          justifyContent: "center",
          ...Platform.select({
            web: { boxShadow: `0px 3px 10px ${GOLD}55` },
            default: {
              shadowColor: GOLD,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.32,
              shadowRadius: 8,
              elevation: 5,
            },
          }),
        }}
      >
        <Feather name="plus" size={20} color="#fff" />
      </View>
      <Text
        style={{
          fontSize: 10,
          color: GOLD,
          fontFamily: "Inter_500Medium",
          marginTop: 3,
        }}
      >
        Add
      </Text>
    </TouchableOpacity>
  );
}

// ── Tab layout ─────────────────────────────────────────────────
export default function TabLayout() {
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const colorScheme = useColorScheme();
  const router = useRouter();

  /**
   * On every fresh app open / page reload, redirect to Home.
   *
   * Why this works:
   * - Web: the JS module re-evaluates on each page load, so _sessionInitialized
   *   is always false at startup — even if the browser URL points to /meals.
   * - Native: the module evaluates once per app launch, so the redirect fires
   *   on launch and the flag prevents it from firing again during the session.
   *
   * router.replace (not navigate) rewrites history so the user can't
   * "back" into the non-home route that was restored.
   */
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
          tabBarInactiveTintColor: "#909090",
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
            borderTopWidth: 1,
            borderTopColor: isDark ? "#222" : "#E8EDE8",
            elevation: 0,
            height: Platform.OS === "web" ? 72 : undefined,
          },
          tabBarItemStyle: {
            paddingBottom: Platform.OS === "web" ? 8 : 4,
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
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
                size={22}
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
                size={22}
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
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "More",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "grid" : "grid-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        {/* ── Hidden (still accessible via router.push) ── */}
        <Tabs.Screen name="planner"      options={{ href: null }} />
        <Tabs.Screen name="recipes"      options={{ href: null }} />
        <Tabs.Screen name="refresh"      options={{ href: null }} />
        <Tabs.Screen name="shopping"     options={{ href: null }} />
        <Tabs.Screen name="money"        options={{ href: null }} />
        <Tabs.Screen name="saved"        options={{ href: null }} />
        <Tabs.Screen name="preferences"  options={{ href: null }} />
        <Tabs.Screen name="appointments" options={{ href: null }} />
        <Tabs.Screen name="bills"        options={{ href: null }} />
        <Tabs.Screen name="index"        options={{ href: null }} />
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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    zIndex: 999,
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    gap: 0,
    ...Platform.select({
      web: { boxShadow: "0px -4px 24px rgba(0,0,0,0.12)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 20,
      },
    }),
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#2B2B2B",
    marginBottom: 2,
  },
  sheetSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#888",
    fontStyle: "italic",
    marginBottom: 16,
  },
  sheetOptions: { gap: 4 },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  sheetOptionDisabled: { opacity: 0.5 },
  sheetOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOptionText: { flex: 1, gap: 1 },
  sheetOptionLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#2B2B2B",
  },
  sheetOptionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#999",
  },
  sheetCancel: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F7F3EB",
    borderRadius: 14,
  },
  sheetCancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#888",
  },
});
