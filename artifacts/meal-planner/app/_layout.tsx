import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular,
} from "@expo-google-fonts/playfair-display";
import { Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocaleProvider } from "@/context/LocaleContext";
import { PlannerProvider } from "@/context/PlannerContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const addMeta = (name: string, content: string, prop = "name") => {
      if (document.querySelector(`meta[${prop}="${name}"]`)) return;
      const m = document.createElement("meta");
      m.setAttribute(prop, name);
      m.content = content;
      document.head.appendChild(m);
    };
    const addLink = (rel: string, href: string) => {
      if (document.querySelector(`link[rel="${rel}"]`)) return;
      const l = document.createElement("link");
      l.rel = rel;
      (l as HTMLLinkElement).href = href;
      document.head.appendChild(l);
    };
    addLink("manifest", "/manifest.json");
    addLink("apple-touch-icon", "/icons/apple-touch-icon.png");
    addMeta("apple-mobile-web-app-capable", "yes");
    addMeta("apple-mobile-web-app-status-bar-style", "default");
    addMeta("apple-mobile-web-app-title", "Sortii");
    addMeta("format-detection", "telephone=no");
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <LocaleProvider>
              <PlannerProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="home" />
                  <Stack.Screen name="your-week" />
                  <Stack.Screen name="money-setup" />
                  <Stack.Screen
                    name="preferences"
                    options={{ presentation: "modal" }}
                  />
                </Stack>
              </PlannerProvider>
              </LocaleProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
