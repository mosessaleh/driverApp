import * as SecureStore from 'expo-secure-store';
import * as CryptoJS from 'crypto-js';

const ENCRYPTION_KEY_STORE_KEY = 'driverapp.storage.encryptionKey';
const PREFIX = 'enc:v1:';

let cachedKey: string | null = null;

async function getOrCreateKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  try {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY);
    if (!key) {
      key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_KEY, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    cachedKey = key;
    return key;
  } catch {
    return null;
  }
}

export async function encryptString(value: string): Promise<string> {
  try {
    const key = await getOrCreateKey();
    if (!key) return value;

    const encrypted = CryptoJS.AES.encrypt(value, key).toString();
    return `${PREFIX}${encrypted}`;
  } catch {
    return value;
  }
}

export async function decryptString(value: string): Promise<string | null> {
  if (!value || typeof value !== 'string') return null;

  // Legacy plaintext values (pre-encryption) are returned as-is so existing
  // data remains readable; it is re-encrypted on the next write.
  if (!value.startsWith(PREFIX)) return value;

  try {
    const key = await getOrCreateKey();
    if (!key) return null;

    const ciphertext = value.slice(PREFIX.length);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    return plaintext || null;
  } catch {
    return null;
  }
}
