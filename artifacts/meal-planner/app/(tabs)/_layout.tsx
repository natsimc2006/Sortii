import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import Colors from "@/constants/Colors";

function AdjustTabButton({ style }: { style?: any }) {
  const router = useRouter();
  const C = Colors.light;

  return (
    <TouchableOpacity
      style={[style, { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 2 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.navigate("/your-week");
      }}
      activeOpacity={0.82}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: C.primary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: Platform.OS === "ios" ? 0 : 2,
          shadowColor: C.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.22,
          shadowRadius: 7,
          elevation: 4,
        }}
      >
        <Feather name="edit-2" size={16} color="#fff" />
      </View>
      <Text style={{ fontSize: 10, color: C.primary, fontFamily: "Inter_500Medium", marginTop: 1 }}>
        Adjust
      </Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const C = Colors.light;

  return (
    <Tabs
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
      <Tabs.Screen
        name="planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: "Recipes",
          tabBarIcon: ({ color }) => (
            <Feather name="book-open" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="refresh"
        options={{
          title: "",
          tabBarButton: (props) => <AdjustTabButton style={props.style} />,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: "Shopping",
          tabBarIcon: ({ color }) => (
            <Feather name="shopping-cart" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: "Money",
          tabBarIcon: ({ color }) => (
            <Feather name="dollar-sign" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          href: null,
        }}
      />
      <Tabs.Screen
        name="preferences"
        options={{
          title: "Settings",
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
    </Tabs>
  );
}
