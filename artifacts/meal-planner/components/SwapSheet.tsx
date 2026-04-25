import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";

interface SwapSheetProps {
  visible: boolean;
  onPickForMe: () => void;
  onLetMeChoose: () => void;
  onClose: () => void;
}

export function SwapSheet({ visible, onPickForMe, onLetMeChoose, onClose }: SwapSheetProps) {
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <View style={styles.handle} />

        <Text style={[styles.title, { color: C.text }]}>Swap meal</Text>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onPickForMe();
          }}
          activeOpacity={0.75}
          style={styles.optionGold}
        >
          <View style={styles.optionIconGold}>
            <Feather name="zap" size={20} color="#D29A22" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitleGold}>Pick one for me</Text>
            <Text style={styles.optionSubGold}>Smart pick based on your week</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#D29A22" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLetMeChoose();
          }}
          activeOpacity={0.75}
          style={styles.optionTeal}
        >
          <View style={styles.optionIconTeal}>
            <Feather name="search" size={20} color="#2A8F88" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitleTeal}>Let me choose</Text>
            <Text style={styles.optionSubTeal}>Browse and pick what sounds good</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#2A8F88" />
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={styles.cancelRow}>
          <Text style={[styles.cancelText, { color: C.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    ...Platform.select({
      web: { boxShadow: "0px -4px 24px rgba(0,0,0,0.14)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.13,
        shadowRadius: 12,
        elevation: 14,
      },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 2,
  },
  optionGold: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D29A2255",
    backgroundColor: "#FDF5E4",
    padding: 14,
  },
  optionIconGold: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F6E6BA",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionTitleGold: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#8B6914",
  },
  optionSubGold: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#A07B2A",
    marginTop: 1,
  },
  optionTeal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2A8F8844",
    backgroundColor: "#EDF6F5",
    padding: 14,
  },
  optionIconTeal: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#D5EDEB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionTitleTeal: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#1C6059",
  },
  optionSubTeal: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#2A8F88",
    marginTop: 1,
  },
  optionText: {
    flex: 1,
  },
  cancelRow: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 2,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
