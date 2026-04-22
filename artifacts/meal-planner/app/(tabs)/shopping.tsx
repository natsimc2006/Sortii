import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";
import { scaleQuantity } from "@/constants/recipes";
import { usePlanner } from "@/context/PlannerContext";

// ─── Category mapping ─────────────────────────────────────────────────────
type SpecCat = "meat" | "dairy" | "produce" | "pantry" | "herbs" | "bread" | "other";

const INGREDIENT_CAT_MAP: Record<string, SpecCat> = {
  proteins: "meat",
  dairy: "dairy",
  vegetables: "produce",
  fruit: "produce",
  pantry: "pantry",
  condiments: "pantry",
  frozen: "pantry",
  herbs: "herbs",
  grains: "bread",
};

const CAT_ORDER: SpecCat[] = ["meat", "dairy", "produce", "pantry", "herbs", "bread", "other"];

const CAT_META: Record<SpecCat, { label: string; emoji: string; color: string }> = {
  meat:    { label: "Meat & Seafood",  emoji: "🥩", color: "#C0392B" },
  dairy:   { label: "Dairy & Eggs",   emoji: "🥛", color: "#2980B9" },
  produce: { label: "Fruit & Veg",    emoji: "🥦", color: "#27AE60" },
  pantry:  { label: "Pantry & Tins",  emoji: "🥫", color: "#8D6E63" },
  herbs:   { label: "Herbs & Spices", emoji: "🌿", color: "#16A085" },
  bread:   { label: "Bread & Bakery", emoji: "🍞", color: "#E67E22" },
  other:   { label: "Other",          emoji: "🛍️", color: "#7F8C8D" },
};

// ─── Qty helpers ──────────────────────────────────────────────────────────
function formatQty(qty: number, unit: string): string {
  const isWhole = !unit || unit === "whole" || unit === "pieces";
  const r = qty < 1 ? Math.round(qty * 10) / 10 : Math.round(qty * 2) / 2;
  return isWhole ? `× ${Math.round(r)}` : `${r} ${unit}`;
}

function stepFor(unit: string): number {
  if (unit === "g" || unit === "ml") return 50;
  if (unit === "kg" || unit === "L") return 0.5;
  return 1;
}

// ─── Types ────────────────────────────────────────────────────────────────
interface ShopItem {
  key: string;
  name: string;
  baseQty: number;
  unit: string;
  cat: SpecCat;
  recipes: string[];
}

interface Extra {
  id: string;
  name: string;
}

// ─── Main component ───────────────────────────────────────────────────────
export default function ShoppingScreen() {
  const { currentPlan, getRecipeById, preferences, estimatedCostBand } = usePlanner();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraChecked, setExtraChecked] = useState<Set<string>>(new Set());
  const [extraInput, setExtraInput] = useState("");
  const [alreadyExpanded, setAlreadyExpanded] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [shoppingTipDismissed, setShoppingTipDismissed] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSubView, setShareSubView] = useState<null | "send">(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  // ─── Voice input ─────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState(""); // live preview of current phrase
  const [voiceSessionCount, setVoiceSessionCount] = useState(0); // items added this session
  const [voiceLastAdded, setVoiceLastAdded] = useState<string | null>(null); // flash confirmation
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [permDeniedBanner, setPermDeniedBanner] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const webRecognitionRef = useRef<any>(null);
  const nativeLoopingRef = useRef(false);
  const lastAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("sortii_shopping_tip_dismissed").then((val) => {
      setShoppingTipDismissed(val === "true");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setVoiceSupported(!!SR);
    } else {
      try {
        const Voice = require("@react-native-voice/voice").default;
        Voice.isAvailable()
          .then((ok: boolean) => setVoiceSupported(ok))
          .catch(() => setVoiceSupported(false));
      } catch {
        setVoiceSupported(false);
      }
    }
    return () => {
      if (Platform.OS !== "web") {
        try {
          const Voice = require("@react-native-voice/voice").default;
          nativeLoopingRef.current = false;
          Voice.destroy().then(() => Voice.removeAllListeners());
        } catch {}
      } else if (webRecognitionRef.current) {
        webRecognitionRef.current.stop();
      }
    };
  }, []);

  const startPulse = () => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  };

  const stopPulse = () => {
    if (pulseLoopRef.current) pulseLoopRef.current.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  // Adds one parsed phrase. Called each time a final result comes in.
  const addPhraseItems = (phrase: string, isSessionReset = false) => {
    const parts = phrase
      .split(/,| and | & /i)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

    if (parts.length === 0) return;

    const ts = Date.now();
    const newExtras: Extra[] = parts.map((name, i) => ({ id: `${ts}-${i}`, name }));
    setExtras((prev) => [...prev, ...newExtras]);
    setVoiceInterim("");

    // Update session counter
    setVoiceSessionCount((n) => isSessionReset ? parts.length : n + parts.length);

    // Flash the last-added label briefly
    const label = parts.length === 1 ? parts[0] : `${parts.length} items`;
    setVoiceLastAdded(label);
    if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
    lastAddedTimerRef.current = setTimeout(() => setVoiceLastAdded(null), 1800);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const startListening = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoiceSessionCount(0);
    setVoiceInterim("");
    setVoiceLastAdded(null);

    if (Platform.OS === "web") {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      try {
        await (navigator as any).mediaDevices.getUserMedia({ audio: true });
      } catch {
        setPermDeniedBanner(true);
        return;
      }
      const recognition = new SR();
      recognition.lang = "en-AU";
      recognition.continuous = true;   // keep mic open across pauses
      recognition.interimResults = true;

      recognition.onresult = (e: any) => {
        // Show live interim for the current phrase
        const latest = e.results[e.results.length - 1];
        if (!latest.isFinal) {
          setVoiceInterim(latest[0].transcript);
          return;
        }
        // A natural pause — treat this phrase as a completed item
        const phrase = latest[0].transcript.trim();
        if (phrase) {
          setVoiceInterim("");
          addPhraseItems(phrase);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === "not-allowed") setPermDeniedBanner(true);
        // "no-speech" is benign — just keep going
        if (e.error !== "no-speech") {
          setIsListening(false);
          setVoiceInterim("");
          stopPulse();
        }
      };

      recognition.onend = () => {
        // Continuous mode can end if browser cuts it — restart if still listening
        if (webRecognitionRef.current) {
          try { recognition.start(); } catch {}
        }
      };

      webRecognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      startPulse();

    } else {
      try {
        const Voice = require("@react-native-voice/voice").default;
        nativeLoopingRef.current = true;

        const handleResult = async (e: any) => {
          const phrase = e.value?.[0] ?? "";
          if (phrase.trim()) addPhraseItems(phrase);
          setVoiceInterim("");
          // Restart immediately if still in loop
          if (nativeLoopingRef.current) {
            try { await Voice.start("en-AU"); } catch {}
          }
        };

        Voice.onSpeechResults = handleResult;
        Voice.onSpeechPartialResults = (e: any) => {
          setVoiceInterim(e.value?.[0] ?? "");
        };
        Voice.onSpeechError = async (e: any) => {
          // "no speech" is fine — just restart
          if (nativeLoopingRef.current) {
            try { await Voice.start("en-AU"); } catch {}
          }
        };

        await Voice.start("en-AU");
        setIsListening(true);
        startPulse();
      } catch (e) {
        setVoiceSupported(false);
      }
    }
  };

  const stopListening = async () => {
    nativeLoopingRef.current = false;
    if (Platform.OS === "web") {
      if (webRecognitionRef.current) {
        webRecognitionRef.current.onend = null; // prevent auto-restart
        webRecognitionRef.current.stop();
        webRecognitionRef.current = null;
      }
    } else {
      try {
        const Voice = require("@react-native-voice/voice").default;
        await Voice.stop();
      } catch {}
    }
    setIsListening(false);
    setVoiceInterim("");
    stopPulse();
    if (voiceSessionCount > 0) {
      showToast(`${voiceSessionCount} item${voiceSessionCount !== 1 ? "s" : ""} added.`);
    }
    setVoiceSessionCount(0);
  };

  // ─── Compute shopping items ─────────────────────────────────────────────
  const allItems = useMemo<ShopItem[]>(() => {
    const map = new Map<string, ShopItem>();
    try {
      for (const entry of (currentPlan ?? [])) {
        if (!entry?.recipeId) continue;
        const recipe = getRecipeById(entry.recipeId);
        if (!recipe?.ingredients) continue;
        for (const ing of recipe.ingredients) {
          if (!ing?.name) continue;
          const scaled = scaleQuantity(
            ing.quantity ?? 1,
            recipe.baseServings ?? 4,
            preferences.householdSize ?? 4,
          );
          const key = `${ing.name.toLowerCase().trim()}_${ing.unit ?? ""}`;
          const cat: SpecCat = INGREDIENT_CAT_MAP[ing.category ?? ""] ?? "other";
          if (map.has(key)) {
            const ex = map.get(key)!;
            ex.baseQty += scaled;
            if (!ex.recipes.includes(recipe.name)) ex.recipes.push(recipe.name);
          } else {
            map.set(key, { key, name: ing.name, baseQty: scaled, unit: ing.unit ?? "", cat, recipes: [recipe.name] });
          }
        }
      }
    } catch (e) {
      console.warn("[Sortii] Shopping list computation error:", e);
    }
    return Array.from(map.values());
  }, [currentPlan, getRecipeById, preferences.householdSize]);

  const visibleItems = allItems.filter((i) => !deleted.has(i.key) && !checked.has(i.key));
  const checkedItems = allItems.filter((i) => !deleted.has(i.key) && checked.has(i.key));
  const checkedExtras = extras.filter((e) => extraChecked.has(e.id));
  const uncheckedExtras = extras.filter((e) => !extraChecked.has(e.id));
  const totalChecked = checkedItems.length + checkedExtras.length;
  const totalVisible = visibleItems.length + uncheckedExtras.length;

  const byCategory = useMemo(() => {
    const groups: Partial<Record<SpecCat, ShopItem[]>> = {};
    for (const item of visibleItems) {
      if (!groups[item.cat]) groups[item.cat] = [];
      groups[item.cat]!.push(item);
    }
    return groups;
  }, [visibleItems]);

  const activeCats = CAT_ORDER.filter((c) => (byCategory[c]?.length ?? 0) > 0);

  // ─── Qty controls ───────────────────────────────────────────────────────
  const getQty = (item: ShopItem) => qtys[item.key] ?? item.baseQty;

  const adjustQty = (item: ShopItem, delta: number) => {
    const step = stepFor(item.unit);
    const current = getQty(item);
    const next = Math.max(step, current + delta * step);
    setQtys((prev) => ({ ...prev, [item.key]: next }));
  };

  // ─── Interactions ───────────────────────────────────────────────────────
  const toggleCheck = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExtraCheck = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExtraChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteItem = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleted((prev) => new Set([...prev, key]));
    setChecked((prev) => { const n = new Set(prev); n.delete(key); return n; });
  };

  const deleteExtra = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExtras((prev) => prev.filter((e) => e.id !== id));
    setExtraChecked((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const addExtra = () => {
    const name = extraInput.trim();
    if (!name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExtras((prev) => [...prev, { id: Date.now().toString(), name }]);
    setExtraInput("");
    Keyboard.dismiss();
    showToast("Added.");
  };

  const clearChecked = () => {
    checkedItems.forEach((i) => setDeleted((prev) => new Set([...prev, i.key])));
    setChecked(new Set());
    setExtras((prev) => prev.filter((e) => !extraChecked.has(e.id)));
    setExtraChecked(new Set());
    setClearConfirm(false);
    showToast(`Removed ${totalChecked} items.`);
  };

  // ─── Share ──────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  const buildListText = () => {
    let text = `SORTII SHOPPING LIST\nWeek of ${today}\n\n`;
    for (const cat of activeCats) {
      text += `${CAT_META[cat].label.toUpperCase()}\n`;
      for (const item of byCategory[cat] || []) {
        text += `• ${item.name} — ${formatQty(getQty(item), item.unit)}\n`;
      }
      text += "\n";
    }
    if (uncheckedExtras.length > 0) {
      text += `EXTRAS\n`;
      uncheckedExtras.forEach((e) => (text += `• ${e.name}\n`));
      text += "\n";
    }
    text += `————————————\nGenerated by Sortii`;
    return text;
  };

  const handleOpenNotes = async () => {
    const text = buildListText();
    await Clipboard.setStringAsync(text);
    setShareOpen(false);
    setShareSubView(null);
    showToast("Copied! Paste into Notes.");
    try { await Linking.openURL("notes://"); } catch (_) {}
  };

  const handleEmail = async () => {
    const body = encodeURIComponent(buildListText());
    setShareOpen(false);
    setShareSubView(null);
    await Linking.openURL(`mailto:?subject=Sortii Shopping List&body=${body}`);
  };

  const handleSMS = async () => {
    const body = encodeURIComponent(buildListText());
    setShareOpen(false);
    setShareSubView(null);
    await Linking.openURL(`sms:?body=${body}`);
  };

  // ─── FOOTER HEIGHT ───────────────────────────────────────────────────────
  const TAB_BAR_HEIGHT = Platform.OS === "web" ? 72 : 58;
  const footerBottom = TAB_BAR_HEIGHT + (Platform.OS !== "web" ? insets.bottom : 0);
  const footerH = 185 + footerBottom;

  // ─── Empty state ─────────────────────────────────────────────────────────
  if (allItems.length === 0) {
    return (
      <View style={[styles.flex, { backgroundColor: C.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8, borderBottomColor: C.cardBorder }]}>
          <Text style={[styles.title, { color: C.text }]}>Shopping List</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={[styles.emptyHeading, { color: C.text }]}>Nothing here yet.</Text>
          <Text style={[styles.emptySub, { color: C.textSecondary }]}>
            Plan your week first, then your list builds itself.
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: C.primary }]}
            onPress={() => router.push("/(tabs)/planner")}
          >
            <Text style={styles.emptyBtnText}>Go to Planner</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.flex, { backgroundColor: C.background }]}>
      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: C.primary, top: Platform.OS === "web" ? 80 : insets.top + 12 }]}>
          <Feather name="check" size={13} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8, borderBottomColor: C.cardBorder }]}>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: C.text }]}>Shopping List</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            {totalVisible} items · Est. {estimatedCostBand}
          </Text>
        </View>
        {totalChecked > 0 && !clearConfirm && (
          <TouchableOpacity
            onPress={() => setClearConfirm(true)}
            style={[styles.clearBtn, { backgroundColor: C.chipBg }]}
          >
            <Text style={[styles.clearBtnText, { color: C.primary }]}>Clear checked</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Inline clear confirm */}
      {clearConfirm && (
        <View style={[styles.confirmBar, { backgroundColor: C.dangerBg, borderColor: C.danger }]}>
          <Text style={[styles.confirmText, { color: C.danger }]}>
            Remove {totalChecked} checked {totalChecked === 1 ? "item" : "items"}?
          </Text>
          <View style={styles.confirmBtns}>
            <TouchableOpacity onPress={() => setClearConfirm(false)} style={[styles.confirmBtn, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.confirmBtnLabel, { color: C.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearChecked} style={[styles.confirmBtn, { backgroundColor: C.danger }]}>
              <Text style={[styles.confirmBtnLabel, { color: "#fff" }]}>Yes, remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.listContent, { paddingBottom: footerH + 20 }]}
      >
        {/* Shopping tip — first visit banner */}
        {!shoppingTipDismissed && (
          <View style={[styles.shoppingTip, { backgroundColor: C.tealTint, borderColor: "rgba(42,143,136,0.2)" }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.shoppingTipTitle, { color: C.primary }]}>
                  Everything's already in here.
                </Text>
                <Text style={[styles.shoppingTipSub, { color: C.text }]}>
                  Your meal ingredients are added automatically — just add anything extra you need.
                </Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  await AsyncStorage.setItem("sortii_shopping_tip_dismissed", "true");
                  setShoppingTipDismissed(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 8, marginTop: 2 }}
              >
                <Feather name="x" size={16} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tick hint */}
        <Text style={[styles.tickHint, { color: C.textMuted }]}>
          Tap an item to tick it off if you already have it at home.
        </Text>

        {/* Category sections */}
        {activeCats.map((cat) => (
          <View key={cat} style={styles.section}>
            <View style={styles.catHeader}>
              <Text style={styles.catEmoji}>{CAT_META[cat].emoji}</Text>
              <Text style={[styles.catLabel, { color: C.text }]}>{CAT_META[cat].label}</Text>
              <Text style={[styles.catCount, { color: C.textMuted }]}>{byCategory[cat]?.length}</Text>
            </View>
            {(byCategory[cat] || []).map((item) => (
              <ItemRow
                key={item.key}
                item={item}
                qty={getQty(item)}
                onCheck={() => toggleCheck(item.key)}
                onDelete={() => deleteItem(item.key)}
                onAdjust={(d) => adjustQty(item, d)}
                C={C}
              />
            ))}
          </View>
        ))}

        {/* Custom added items — input is in sticky footer */}
        {uncheckedExtras.length > 0 && (
          <View style={[styles.section, { paddingTop: 0 }]}>
            {uncheckedExtras.map((extra) => (
              <ExtraRow
                key={extra.id}
                extra={extra}
                checked={false}
                onCheck={() => toggleExtraCheck(extra.id)}
                onDelete={() => deleteExtra(extra.id)}
                C={C}
              />
            ))}
          </View>
        )}

        {/* Already have it */}
        {(checkedItems.length > 0 || checkedExtras.length > 0) && (
          <View style={styles.section}>
            <TouchableOpacity
              onPress={() => setAlreadyExpanded((v) => !v)}
              style={[styles.alreadyHeader, { backgroundColor: C.chipBg, borderColor: C.cardBorder }]}
              activeOpacity={0.7}
            >
              <Feather name="check-circle" size={16} color={C.primary} />
              <Text style={[styles.alreadyLabel, { color: C.primary }]}>
                Already have it ({totalChecked})
              </Text>
              <Feather name={alreadyExpanded ? "chevron-up" : "chevron-down"} size={16} color={C.primary} />
            </TouchableOpacity>
            {alreadyExpanded && (
              <View style={styles.alreadyList}>
                {checkedItems.map((item) => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    qty={getQty(item)}
                    isChecked
                    onCheck={() => toggleCheck(item.key)}
                    onDelete={() => deleteItem(item.key)}
                    onAdjust={(d) => adjustQty(item, d)}
                    C={C}
                  />
                ))}
                {checkedExtras.map((extra) => (
                  <ExtraRow
                    key={extra.id}
                    extra={extra}
                    checked
                    onCheck={() => toggleExtraCheck(extra.id)}
                    onDelete={() => deleteExtra(extra.id)}
                    C={C}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <View
        style={[
          styles.footer,
          { paddingBottom: 12, bottom: footerBottom, borderTopColor: C.cardBorder, backgroundColor: C.card },
        ]}
      >
        {/* Add your own — sticky input */}
        <View style={styles.catHeader}>
          <Text style={styles.catEmoji}>✏️</Text>
          <View style={styles.flex}>
            <Text style={[styles.catLabel, { color: C.text }]}>Add your own</Text>
            <Text style={[styles.addHint, { color: C.textMuted }]}>Toilet paper, snacks, whatever.</Text>
          </View>
        </View>

        {permDeniedBanner && (
          <View style={[styles.permBanner, { backgroundColor: C.chipBg }]}>
            <Text style={[styles.permBannerText, { color: C.primary }]}>
              Enable microphone access in Settings to use voice input.
            </Text>
            <TouchableOpacity onPress={() => setPermDeniedBanner(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={15} color={C.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Voice listening panel — shown when mic is active ── */}
        {isListening ? (
          <View style={[styles.voicePanel, { backgroundColor: C.tealTint, borderColor: C.primary }]}>
            {/* Live interim transcript */}
            <View style={styles.voicePanelTop}>
              <Animated.View style={[styles.voiceLiveDot, { backgroundColor: C.primary, opacity: pulseAnim }]} />
              <Text
                style={[styles.voiceInterimText, { color: voiceInterim ? C.text : C.textMuted }]}
                numberOfLines={2}
              >
                {voiceInterim || "Listening…"}
              </Text>
            </View>

            {/* Last added flash */}
            {voiceLastAdded && (
              <View style={[styles.voiceAddedBadge, { backgroundColor: C.primary }]}>
                <Feather name="check" size={11} color="#fff" />
                <Text style={styles.voiceAddedText}>Added: {voiceLastAdded}</Text>
              </View>
            )}

            {/* Counter + stop button */}
            <View style={styles.voicePanelBottom}>
              <Text style={[styles.voiceCountText, { color: C.primary }]}>
                {voiceSessionCount > 0
                  ? `${voiceSessionCount} item${voiceSessionCount !== 1 ? "s" : ""} added`
                  : "Say an item — pause — say the next"}
              </Text>
              <TouchableOpacity
                onPress={stopListening}
                activeOpacity={0.8}
                style={[styles.voiceStopBtn, { backgroundColor: C.primary }]}
              >
                <Feather name="mic-off" size={13} color="#fff" />
                <Text style={styles.voiceStopText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ── Normal text + mic row ── */
          <View style={[styles.addRow, { backgroundColor: C.background, borderColor: C.cardBorder, marginBottom: 10 }]}>
            <TextInput
              value={extraInput}
              onChangeText={setExtraInput}
              onSubmitEditing={addExtra}
              placeholder="Item name"
              placeholderTextColor={C.textMuted}
              returnKeyType="done"
              style={[styles.addInput, { color: C.text }]}
            />
            {voiceSupported !== false && (
              <TouchableOpacity
                onPress={startListening}
                style={[styles.micBtn, { backgroundColor: "transparent", borderWidth: 1.5, borderColor: C.primary }]}
                activeOpacity={0.75}
              >
                <Feather name="mic" size={15} color={C.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={addExtra}
              style={[styles.addBtn, { backgroundColor: C.primary, opacity: extraInput.trim() ? 1 : 0.4 }]}
            >
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: C.gold }]}
          onPress={() => { setShareSubView(null); setShareOpen(true); }}
          activeOpacity={0.85}
        >
          <Feather name="share-2" size={18} color="#fff" />
          <Text style={styles.shareBtnText}>Share list</Text>
        </TouchableOpacity>
      </View>

      {/* Share bottom sheet */}
      <Modal
        visible={shareOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { setShareOpen(false); setShareSubView(null); }}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => { setShareOpen(false); setShareSubView(null); }}
        />
        <View style={[styles.sheet, { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16, backgroundColor: C.card }]}>
          <View style={[styles.sheetHandle, { backgroundColor: C.cardBorder }]} />
          <Text style={[styles.sheetTitle, { color: C.text }]}>Share your list</Text>

          {shareSubView === null ? (
            <>
              <TouchableOpacity style={[styles.sheetOption, { borderColor: C.cardBorder }]} onPress={handleOpenNotes}>
                <View style={[styles.sheetOptionIcon, { backgroundColor: C.chipBg }]}>
                  <Feather name="edit-3" size={20} color={C.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.sheetOptionTitle, { color: C.text }]}>Open in Notes</Text>
                  <Text style={[styles.sheetOptionSub, { color: C.textSecondary }]}>Copies list to clipboard, then opens Notes</Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.sheetOption, { borderColor: C.cardBorder }]} onPress={() => setShareSubView("send")}>
                <View style={[styles.sheetOptionIcon, { backgroundColor: C.chipBg }]}>
                  <Feather name="send" size={20} color={C.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.sheetOptionTitle, { color: C.text }]}>Send to myself</Text>
                  <Text style={[styles.sheetOptionSub, { color: C.textSecondary }]}>Email or SMS</Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.textMuted} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => setShareSubView(null)} style={styles.sheetBack}>
                <Feather name="arrow-left" size={16} color={C.primary} />
                <Text style={[styles.sheetBackText, { color: C.primary }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetOption, { borderColor: C.cardBorder }]} onPress={handleEmail}>
                <View style={[styles.sheetOptionIcon, { backgroundColor: C.chipBg }]}>
                  <Feather name="mail" size={20} color={C.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.sheetOptionTitle, { color: C.text }]}>Email</Text>
                  <Text style={[styles.sheetOptionSub, { color: C.textSecondary }]}>Opens your mail app</Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.sheetOption, { borderColor: C.cardBorder }]} onPress={handleSMS}>
                <View style={[styles.sheetOptionIcon, { backgroundColor: C.chipBg }]}>
                  <Feather name="message-square" size={20} color={C.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.sheetOptionTitle, { color: C.text }]}>SMS</Text>
                  <Text style={[styles.sheetOptionSub, { color: C.textSecondary }]}>Opens your messages app</Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.textMuted} />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => { setShareOpen(false); setShareSubView(null); }}
            style={[styles.sheetCancel, { backgroundColor: C.chipBg }]}
          >
            <Text style={[styles.sheetCancelText, { color: C.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ─── ItemRow ──────────────────────────────────────────────────────────────
function ItemRow({
  item, qty, isChecked = false,
  onCheck, onDelete, onAdjust, C,
}: {
  item: ShopItem; qty: number; isChecked?: boolean;
  onCheck: () => void; onDelete: () => void; onAdjust: (d: number) => void;
  C: typeof Colors.light;
}) {
  return (
    <View style={[styles.itemRow, { backgroundColor: C.card, borderColor: C.cardBorder, opacity: isChecked ? 0.55 : 1 }]}>
      <TouchableOpacity onPress={onCheck} style={[styles.checkbox, { borderColor: isChecked ? C.primary : C.inputBorder, backgroundColor: isChecked ? C.primary : "transparent" }]}>
        {isChecked && <Feather name="check" size={12} color="#fff" />}
      </TouchableOpacity>
      <View style={styles.flex}>
        <Text style={[styles.itemName, { color: C.text }, isChecked && styles.strikethrough]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.recipes.length > 1 && (
          <Text style={[styles.itemHint, { color: C.textMuted }]}>Used in {item.recipes.length} meals</Text>
        )}
      </View>
      {!isChecked && (
        <View style={styles.qtyControl}>
          <TouchableOpacity onPress={() => onAdjust(-1)} style={[styles.qtyBtn, { backgroundColor: C.chipBg }]}>
            <Feather name="minus" size={12} color={C.primary} />
          </TouchableOpacity>
          <Text style={[styles.qtyText, { color: C.text }]}>{formatQty(qty, item.unit)}</Text>
          <TouchableOpacity onPress={() => onAdjust(1)} style={[styles.qtyBtn, { backgroundColor: C.chipBg }]}>
            <Feather name="plus" size={12} color={C.primary} />
          </TouchableOpacity>
        </View>
      )}
      {isChecked && (
        <Text style={[styles.qtyText, { color: C.textMuted }]}>{formatQty(qty, item.unit)}</Text>
      )}
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={14} color="#B86557" />
      </TouchableOpacity>
    </View>
  );
}

// ─── ExtraRow ─────────────────────────────────────────────────────────────
function ExtraRow({
  extra, checked, onCheck, onDelete, C,
}: {
  extra: Extra; checked: boolean;
  onCheck: () => void; onDelete: () => void;
  C: typeof Colors.light;
}) {
  return (
    <View style={[styles.itemRow, { backgroundColor: C.card, borderColor: C.cardBorder, opacity: checked ? 0.55 : 1 }]}>
      <TouchableOpacity onPress={onCheck} style={[styles.checkbox, { borderColor: checked ? C.primary : C.inputBorder, backgroundColor: checked ? C.primary : "transparent" }]}>
        {checked && <Feather name="check" size={12} color="#fff" />}
      </TouchableOpacity>
      <Text style={[styles.flex, styles.itemName, { color: C.text }, checked && styles.strikethrough]} numberOfLines={1}>
        {extra.name}
      </Text>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={14} color="#B86557" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 3 },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 4,
  },
  clearBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  confirmBar: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  confirmText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  confirmBtns: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  confirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmBtnLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  listContent: { padding: 16, gap: 24 },
  shoppingTip: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  shoppingTipTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  shoppingTipSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  section: { gap: 8 },
  catHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  catEmoji: { fontSize: 18 },
  catLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold" },
  catCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  addHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  tickHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4, marginHorizontal: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  strikethrough: { textDecorationLine: "line-through" },
  itemHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  qtyControl: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 44, textAlign: "center" },
  deleteBtn: { padding: 2 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  addInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 6,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  permBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  alreadyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  alreadyLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  alreadyList: { gap: 8, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: "#F0AC2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 5,
  },
  shareBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 8, textAlign: "center" },
  sheetBack: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  sheetBackText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  sheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOptionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sheetOptionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  sheetCancel: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  sheetCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  toast: {
    position: "absolute",
    zIndex: 99,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  toastText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingBottom: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 48 },
  emptyHeading: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },

  // ── Voice panel ────────────────────────────────────────────
  voicePanel: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  voicePanelTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  voiceLiveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    flexShrink: 0,
  },
  voiceInterimText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    fontStyle: "italic",
  },
  voiceAddedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  voiceAddedText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  voicePanelBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  voiceCountText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  voiceStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  voiceStopText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
