import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { usePlanner } from "@/context/PlannerContext";

const C = Colors.light;

type OptionConfig = {
  icon: string;
  accentColor: string;
  bgColor: string;
  title: string;
  sub: string;
  btnLabel: string;
  onPress: () => void;
};

function OptionCard({ icon, accentColor, bgColor, title, sub, btnLabel, onPress }: OptionConfig) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, { borderColor: accentColor }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.optionIconBox, { backgroundColor: bgColor }]}>
        <Feather name={icon as any} size={20} color={accentColor} />
      </View>
      <View style={styles.optionBody}>
        <Text style={[styles.optionTitle, { color: C.text }]}>{title}</Text>
        <Text style={[styles.optionSub, { color: C.textSecondary }]}>{sub}</Text>
      </View>
      <TouchableOpacity
        style={[styles.optionBtn, { backgroundColor: accentColor }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={styles.optionBtnText}>{btnLabel}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function SortHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { autoGeneratePlan } = usePlanner();

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/planner");
    }
  };

  const handleMeals = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)/preferences");
  };

  const handleMoney = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/money-setup");
  };

  const handleBoth = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    autoGeneratePlan();
    router.replace("/(tabs)/planner");
  };

  const sheetPaddingBottom = Platform.OS === "web" ? 32 : insets.bottom + 20;

  return (
    <View style={styles.root}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      <View style={[styles.sheet, { paddingBottom: sheetPaddingBottom }]}>
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderText}>
            <Text style={[styles.sheetTitle, { color: C.text }]}>What do you want to update?</Text>
            <Text style={[styles.sheetSub, { color: C.textSecondary }]}>
              Pick one and we'll do the rest.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeBtn}
          >
            <Feather name="x" size={21} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.options}>
          <OptionCard
            icon="calendar"
            accentColor={C.primary}
            bgColor={C.tealTint}
            title="Meals"
            sub="Change dinners, preferences, or budget level"
            btnLabel="Update meals"
            onPress={handleMeals}
          />
          <OptionCard
            icon="dollar-sign"
            accentColor={C.gold}
            bgColor="#FEF3C7"
            title="Money"
            sub="Update your weekly numbers or savings goal"
            btnLabel="Update money"
            onPress={handleMoney}
          />
          <OptionCard
            icon="refresh-cw"
            accentColor={C.plum}
            bgColor="#F3ECF5"
            title="Both"
            sub="Rebuild the whole week from scratch"
            btnLabel="Redo my week"
            onPress={handleBoth}
          />
        </View>

        <TouchableOpacity onPress={handleClose} style={styles.cancelRow} activeOpacity={0.7}>
          <Text style={[styles.cancelText, { color: C.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDE0DE",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  sheetTitle: {
    fontSize: 19,
    fontFamily: "Manrope_700Bold",
    lineHeight: 26,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  closeBtn: {
    marginTop: 2,
  },
  options: {
    gap: 12,
    marginBottom: 18,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FAFAFA",
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  optionBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  cancelRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
