import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

/** Small key-value storage: the keychain / keystore on phones, localStorage on the web preview. */
const web = Platform.OS === 'web'

export async function getItem(key: string): Promise<string | null> {
  try {
    if (web) return globalThis.localStorage?.getItem(key) ?? null
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (web) globalThis.localStorage?.setItem(key, value)
    else await SecureStore.setItemAsync(key, value)
  } catch {
    // Storage can be unavailable; the app still works for this session.
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (web) globalThis.localStorage?.removeItem(key)
    else await SecureStore.deleteItemAsync(key)
  } catch {
    // Nothing to clean up.
  }
}
