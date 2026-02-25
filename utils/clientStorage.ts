import { Platform } from "react-native";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  SecureStore = require("expo-secure-store");
}

export async function getPersistedItem(key: string): Promise<string | null> {
  if (SecureStore) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setPersistedItem(key: string, value: string): Promise<void> {
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      return;
    }
    return;
  }

  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function getSessionItem(key: string): string | null {
  if (Platform.OS !== "web") {
    return null;
  }

  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSessionItem(key: string, value: string): void {
  if (Platform.OS !== "web") {
    return;
  }

  try {
    sessionStorage.setItem(key, value);
  } catch {
    return;
  }
}
