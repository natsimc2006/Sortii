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
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocaleProvider } from "@/context/LocaleContext";
import { PlannerProvider } from "@/context/PlannerContext";
import { UserWeekProvider } from "@/context/UserWeekContext";
import { getAuthUser } from "@/utils/authStore";
import { setCurrentUserId } from "@/utils/currentUser";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// ── Auth guard ────────────────────────────────────────────────────────────────
// Checks auth state once at boot. If no auth record exists, routes to /sign-in.
// Once auth resolves, setCurrentUserId() scopes all AsyncStorage keys to that user.
//
// Migration path: when adding a server layer, replace getAuthUser() with a
// token validation call here, and update setCurrentUserId to use the JWT sub.
// ─────────────────────────────────────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const segments = useSegments();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getAuthUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      // Route to sign-in only if no user AND not already on sign-in
      const onSignIn = segments[0] === "sign-in";
      if (!user && !onSignIn) {
        router.replace("/sign-in");
      }
      setAuthChecked(true);
    })();
  }, []);

  if (!authChecked) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
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
              <UserWeekProvider>
              <PlannerProvider>
                <AuthGate>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="sign-in" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="home" />
                    <Stack.Screen
                      name="your-week"
                      options={{ presentation: "transparentModal", animation: "slide_from_bottom" }}
                    />
                    <Stack.Screen name="money-setup" />
                    <Stack.Screen
                      name="preferences"
                      options={{ presentation: "modal" }}
                    />
                  </Stack>
                </AuthGate>
              </PlannerProvider>
              </UserWeekProvider>
              </LocaleProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
