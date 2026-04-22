import AsyncStorage from "@react-native-async-storage/async-storage";
import { SK } from "./storageKeys";
import { getCurrentUserId } from "./currentUser";

function key(): string { return SK.favorites(getCurrentUserId()); }

export async function loadFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key());
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveFavorites(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(key(), JSON.stringify(ids));
}

export async function toggleFavorite(recipeId: string, current: string[]): Promise<string[]> {
  const idx = current.indexOf(recipeId);
  const updated =
    idx >= 0 ? current.filter((id) => id !== recipeId) : [...current, recipeId];
  await saveFavorites(updated);
  return updated;
}
