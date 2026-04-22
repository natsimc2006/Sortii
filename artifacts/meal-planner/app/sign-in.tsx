import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAuthUser, saveAuthUser, signInWithGoogleAuth } from "@/utils/authStore";
import { setCurrentUserId } from "@/utils/currentUser";

const TEAL  = "#2A8F88";
const CREAM = "#F8F4EE";
const INK   = "#1A1410";
const MUTED = "#8A7968";
const GOLD  = "#D29A22";
const PLUM  = "#5E3A4C";
const CARD  = "#FFFFFF";

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple,  setLoadingApple]  = useState(false);

  const paddingTop    = Platform.OS === "web" ? 60 : insets.top + 16;
  const paddingBottom = Platform.OS === "web" ? 48 : insets.bottom + 24;

  async function handleGoogle() {
    setLoadingGoogle(true);
    try {
      const user = await signInWithGoogleAuth();
      if (user) {
        setCurrentUserId(user.id);
        router.replace("/");
      } else {
        Alert.alert("Sign in failed", "Could not complete Google sign-in. Please try again.");
      }
    } catch {
      Alert.alert("Sign in failed", "Something went wrong. Please try again.");
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function handleApple() {
    if (Platform.OS !== "ios") return;
    setLoadingApple(true);
    try {
      const { signInWithAppleAuth } = await import("@/utils/authStore");
      const user = await signInWithAppleAuth();
      if (user) {
        setCurrentUserId(user.id);
        router.replace("/");
      } else {
        Alert.alert("Sign in failed", "Could not complete Apple sign-in. Please try again.");
      }
    } catch {
      Alert.alert("Sign in failed", "Something went wrong. Please try again.");
    } finally {
      setLoadingApple(false);
    }
  }

  async function handleSkip() {
    // No auth — create a stable anon-style ID for this device
    const existing = await getAuthUser();
    if (!existing) {
      const anonId = `anon_${Date.now().toString(36)}`;
      await saveAuthUser({
        id: anonId,
        provider: "google",
        signedInAt: Date.now(),
      });
      setCurrentUserId(anonId);
    } else {
      setCurrentUserId(existing.id);
    }
    router.replace("/");
  }

  return (
    <View style={[styles.root, { paddingTop, paddingBottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Wordmark ── */}
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmarkS}>S</Text>
          <Text style={styles.wordmarkOrtii}>ortii</Text>
        </View>

        {/* ── Tagline ── */}
        <Text style={styles.tagline}>
          We take the thinking{"\n"}out of the week.
        </Text>

        <View style={styles.divider} />

        {/* ── Sign-in prompt ── */}
        <Text style={styles.promptHead}>Create your free account</Text>
        <Text style={styles.promptSub}>
          Sign in to keep your data safe and sync across devices soon.
        </Text>

        {/* ── Buttons ── */}
        <View style={styles.buttons}>

          {/* Google */}
          <TouchableOpacity
            onPress={handleGoogle}
            style={styles.googleBtn}
            activeOpacity={0.82}
            disabled={loadingGoogle || loadingApple}
          >
            {loadingGoogle ? (
              <ActivityIndicator color={INK} size="small" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleLabel}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple — iOS only */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              onPress={handleApple}
              style={styles.appleBtn}
              activeOpacity={0.82}
              disabled={loadingGoogle || loadingApple}
            >
              {loadingApple ? (
                <ActivityIndicator color={CREAM} size="small" />
              ) : (
                <>
                  <Text style={styles.appleIcon}></Text>
                  <Text style={styles.appleLabel}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

        </View>

        {/* ── Skip ── */}
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipRow}>
          <Text style={styles.skipText}>Skip for now</Text>
          <Text style={styles.skipArrow}> →</Text>
        </TouchableOpacity>

        {/* ── Privacy note ── */}
        <Text style={styles.privacyNote}>
          Your data stays on your device. Syncing across devices is coming soon.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CREAM,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  wordmarkRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  wordmarkS: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 48,
    color: TEAL,
    letterSpacing: -1,
  },
  wordmarkOrtii: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 42,
    color: TEAL,
    letterSpacing: -1,
  },

  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: MUTED,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },

  divider: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD,
    marginBottom: 32,
  },

  promptHead: {
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
    color: INK,
    textAlign: "center",
    marginBottom: 8,
  },
  promptSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
    maxWidth: 300,
  },

  buttons: {
    width: "100%",
    maxWidth: 340,
    gap: 12,
    marginBottom: 20,
  },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleIcon: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#4285F4",
  },
  googleLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: INK,
  },

  appleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1410",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
  },
  appleIcon: {
    fontSize: 18,
    color: CREAM,
    lineHeight: 22,
  },
  appleLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: CREAM,
  },

  skipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingVertical: 4,
  },
  skipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: TEAL,
  },
  skipArrow: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: TEAL,
  },

  privacyNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
    opacity: 0.7,
  },
});
