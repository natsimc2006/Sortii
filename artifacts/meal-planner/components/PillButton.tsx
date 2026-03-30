import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import Colors from "@/constants/Colors";

interface PillButtonProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  small?: boolean;
}

export function PillButton({
  label,
  active = false,
  onPress,
  style,
  small = false,
}: PillButtonProps) {
  const C = Colors.light;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        small && styles.small,
        {
          backgroundColor: active ? C.primary : C.chipBg,
          borderColor: active ? C.primary : C.inputBorder,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          small && styles.smallLabel,
          { color: active ? "#fff" : C.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  smallLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
