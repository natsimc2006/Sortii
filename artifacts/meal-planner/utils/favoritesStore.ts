import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITES_KEY = "sortii_favorite_recipes";

export async function loadFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveFavorites(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

export async function toggleFavorite(recipeId: string, current: string[]): Promise<string[]> {
  const idx = current.indexOf(recipeId);
  const updated =
    idx >= 0 ? current.filter((id) => id !== recipeId) : [...current, recipeId];
  await saveFavorites(updated);
  return updated;
}
