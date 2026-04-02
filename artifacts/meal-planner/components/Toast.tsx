import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type ToastVariant = "success" | "info" | "undo" | "warning" | "smart-tip";

export interface ToastState {
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  persistent?: boolean;
  onDismiss?: () => void;
}

interface ToastProps extends ToastState {
  visible: boolean;
  duration?: number;
  onAutoHide?: () => void;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; text: string; icon: string; iconColor: string; actionColor: string }> = {
  success: { bg: "#1D7070", text: "#fff", icon: "check-circle", iconColor: "#A7D8D8", actionColor: "#fff" },
  info: { bg: "#E7F4F3", text: "#1D7070", icon: "info", iconColor: "#2C9797", actionColor: "#1D7070" },
  undo: { bg: "#2B2B2B", text: "#fff", icon: "rotate-ccw", iconColor: "#E0E0E0", actionColor: "#DEA829" },
  warning: { bg: "#F7E8BE", text: "#8B6820", icon: "alert-circle", iconColor: "#DEA829", actionColor: "#8B6820" },
  "smart-tip": { bg: "#F3E8EE", text: "#5E3A4C", icon: "zap", iconColor: "#5E3A4C", actionColor: "#5E3A4C" },
};

export function Toast({
  visible,
  message,
  variant,
  actionLabel,
  onAction,
  persistent = false,
  duration = 3000,
  onAutoHide,
  onDismiss,
}: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, speed: 20, bounciness: 4, useNativeDriver: true }),
      ]).start();
      if (!persistent && onAutoHide) {
        timerRef.current = setTimeout(onAutoHide, duration);
      }
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 12, duration: 200, useNativeDriver: true }),
      ]).start();
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const v = VARIANT_STYLES[variant];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: v.bg,
          opacity,
          transform: [{ translateY }],
          pointerEvents: visible ? "auto" : "none",
        } as any,
      ]}
    >
      <Feather name={v.icon as any} size={15} color={v.iconColor} />
      <Text style={[styles.message, { color: v.text }]} numberOfLines={3}>
        {message}
      </Text>
      <View style={styles.actions}>
        {actionLabel && onAction && (
          <TouchableOpacity
            onPress={onAction}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.actionText, { color: v.actionColor }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
        {persistent && onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.closeBtn}
          >
            <Feather name="x" size={14} color={v.iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    boxShadow: "0px 2px 8px rgba(0,0,0,0.12)",
    elevation: 4,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textDecorationLine: "underline",
  },
  closeBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
