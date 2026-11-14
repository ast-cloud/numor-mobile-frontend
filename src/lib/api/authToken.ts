// Same API as the web frontend (sync get/set/clear) but backed by the device keychain.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "access_token";
let cached: string | null = null;

const webStore = {
  get: () => (typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null),
  set: (v: string) => typeof localStorage !== "undefined" && localStorage.setItem(TOKEN_KEY, v),
  del: () => typeof localStorage !== "undefined" && localStorage.removeItem(TOKEN_KEY),
};

/** Load the saved token into memory. Call once before rendering the app. */
export async function hydrateToken() {
  try {
    cached = Platform.OS === "web" ? webStore.get() : await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cached = null;
  }
}

export const setToken = (token: string) => {
  cached = token;
  if (Platform.OS === "web") webStore.set(token);
  else SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
};

export const getToken = (): string | null => cached;

export const clearToken = () => {
  cached = null;
  if (Platform.OS === "web") webStore.del();
  else SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
};
