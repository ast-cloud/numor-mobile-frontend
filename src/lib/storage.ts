// Synchronous key/value storage that stands in for the browser's localStorage.
// Values are cached in memory (hydrated once at startup) and persisted with AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";

const cache = new Map<string, string>();
const KEYS = ["numor-theme", "active_role"];

export async function hydrateStorage() {
  try {
    const pairs = await AsyncStorage.multiGet(KEYS);
    for (const [k, v] of pairs) if (v != null) cache.set(k, v);
  } catch {
    // start with an empty cache
  }
}

export const storage = {
  getItem: (key: string): string | null => cache.get(key) ?? null,
  setItem: (key: string, value: string) => {
    cache.set(key, value);
    AsyncStorage.setItem(key, value).catch(() => {});
  },
  removeItem: (key: string) => {
    cache.delete(key);
    AsyncStorage.removeItem(key).catch(() => {});
  },
};
