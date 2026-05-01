import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface SavingsTipCardProps {
  tipId: string;
  icon: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
}

export function SavingsTipCard(props: SavingsTipCardProps) {
  const { tipId, icon, title, body, primaryLabel, primaryUrl, secondaryLabel, secondaryUrl } = props;

  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const val = await AsyncStorage.getItem(tipId);
        if (!cancelled) setVisible(val !== "dismissed");
      } catch {
        if (!cancelled) setVisible(true);
      }
    })();
    return () => { cancelled = true; };
  }, [tipId]);

  async function dismiss() {
    setVisible(false);
    try {
      await AsyncStorage.setItem(tipId, "dismissed");
    } catch {}
  }

  if (!tipId || !primaryLabel || !primaryUrl) return null;
  if (visible !== true) return null;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.titleRow}>
        {icon ? `${icon}  ` : ""}<Text style={styles.title}>{title}</Text>
      </Text>
      <Text style={styles.body}>{body}</Text>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => Linking.openURL(primaryUrl)}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
      </TouchableOpacity>

      {secondaryLabel && secondaryUrl ? (
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => Linking.openURL(secondaryUrl)}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F3E8EE",
    borderLeftWidth: 4,
    borderLeftColor: "#5E3A4C",
    borderRadius: 12,
    padding: 16,
    paddingTop: 20,
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    right: 10,
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    color: "#999",
  },
  titleRow: {
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
    color: "#2B2B2B",
    marginBottom: 6,
    paddingRight: 24,
  },
  title: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: "#2B2B2B",
  },
  body: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#555555",
    marginBottom: 12,
    lineHeight: 19,
  },
  primaryBtn: {
    backgroundColor: "#5E3A4C",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#5E3A4C",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryBtnText: {
    color: "#5E3A4C",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
