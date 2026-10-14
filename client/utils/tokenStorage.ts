import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * The one place the two auth tokens are read from and written to (spec 39).
 *
 * Storage is platform-dependent (spec 39 D1):
 *   - native (what actually ships as an APK) -> `expo-secure-store`, i.e. the iOS Keychain /
 *     Android Keystore. OS-encrypted, per-app, and not readable from a device backup or by
 *     another app. A real upgrade on the plain-text AsyncStorage the single token used to live in.
 *   - web (a headless-verification target only, per the root CLAUDE.md) -> AsyncStorage, because
 *     `expo-secure-store` has no web implementation: its native module resolves to `{}` there, so
 *     importing is harmless but *calling* any of its methods is a TypeError. Hence the guard
 *     below rather than a try/catch.
 *
 * httpOnly cookies were considered and rejected - see spec 39 D1 for the reasoning.
 *
 * SecureStore keys may only contain alphanumerics, `.`, `-` and `_`; both keys below comply.
 * Each token is stored under its own key rather than as one JSON blob, partly for this and
 * partly because SecureStore values are capped at ~2KB on Android.
 */

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

/**
 * The pre-spec-39 single token, which lived in plain AsyncStorage under `"token"`. Nothing
 * reads it any more - it is only still named here so `clearTokens` can delete it. Server spec
 * 18 rejects any token minted before it (no `type` claim), so there is nothing to migrate:
 * every existing install is signed out once, by design (spec 39 D8).
 */
const LEGACY_TOKEN_KEY = "token";

const useSecureStore = Platform.OS !== "web";

const read = async (key: string) =>
  useSecureStore ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key);

const write = async (key: string, value: string) =>
  useSecureStore
    ? SecureStore.setItemAsync(key, value)
    : AsyncStorage.setItem(key, value);

const remove = async (key: string) =>
  useSecureStore
    ? SecureStore.deleteItemAsync(key)
    : AsyncStorage.removeItem(key);

/**
 * In-memory mirror of the access token, so the axios request interceptor can attach the
 * Authorization header synchronously instead of hitting the Keychain on every single request
 * (which is what the old `AsyncStorage.getItem("token")` did). Kept current by every writer
 * below; populated at boot by `hydrateTokens`.
 */
let accessTokenCache: string | null = null;

export const getAccessToken = (): string | null => accessTokenCache;

export const getRefreshToken = async (): Promise<string | null> =>
  read(REFRESH_TOKEN_KEY);

/** Called once by UserProvider on mount. Returns both tokens and primes the cache. */
export const hydrateTokens = async (): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> => {
  const [accessToken, refreshToken] = await Promise.all([
    read(ACCESS_TOKEN_KEY),
    read(REFRESH_TOKEN_KEY),
  ]);

  accessTokenCache = accessToken;

  return { accessToken, refreshToken };
};

/** Login: store both tokens. */
export const setTokens = async (
  accessToken: string,
  refreshToken: string,
): Promise<void> => {
  accessTokenCache = accessToken;

  await Promise.all([
    write(ACCESS_TOKEN_KEY, accessToken),
    write(REFRESH_TOKEN_KEY, refreshToken),
  ]);
};

/** Refresh: only the access token changes - the refresh token is not rotated (server spec 18 D7). */
export const setAccessToken = async (accessToken: string): Promise<void> => {
  accessTokenCache = accessToken;
  await write(ACCESS_TOKEN_KEY, accessToken);
};

/** Logout, forced or manual. Also drops the legacy pre-spec-39 key. */
export const clearTokens = async (): Promise<void> => {
  accessTokenCache = null;

  await Promise.all([
    remove(ACCESS_TOKEN_KEY),
    remove(REFRESH_TOKEN_KEY),
    // ! always AsyncStorage for this one - that is where the old single token was written.
    AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
  ]);
};
