/**
 * Prominent disclosure gate for Android/iOS background location (Google Play User Data policy).
 * A host component registers the UI; journey code awaits consent before calling
 * requestBackgroundPermissionsAsync().
 */

import * as SecureStore from 'expo-secure-store';

export type BackgroundLocationDisclosureResult = 'accept' | 'decline';

const DISCLOSURE_KEY = 'taatom_bg_location_disclosure_v1';

type DisclosureHandler = () => Promise<BackgroundLocationDisclosureResult>;

let disclosureHandler: DisclosureHandler | null = null;

export function registerBackgroundLocationDisclosureHandler(handler: DisclosureHandler | null): void {
  disclosureHandler = handler;
}

export async function getBackgroundLocationDisclosureChoice(): Promise<BackgroundLocationDisclosureResult | null> {
  try {
    const value = await SecureStore.getItemAsync(DISCLOSURE_KEY);
    if (value === 'accept' || value === 'decline') return value;
    return null;
  } catch {
    return null;
  }
}

async function persistDisclosureChoice(choice: BackgroundLocationDisclosureResult): Promise<void> {
  try {
    await SecureStore.setItemAsync(DISCLOSURE_KEY, choice);
  } catch {
    // Non-blocking — OS permission flow can still proceed this session.
  }
}

/**
 * Shows the in-app prominent disclosure if the user has not decided yet.
 * Returns true when the user agreed to proceed to the system permission dialog.
 */
export async function ensureBackgroundLocationDisclosure(): Promise<boolean> {
  const prior = await getBackgroundLocationDisclosureChoice();
  if (prior === 'accept') return true;
  if (prior === 'decline') return false;

  if (!disclosureHandler) {
    // Fail closed: do not request background location without disclosure UI.
    return false;
  }

  const choice = await disclosureHandler();
  await persistDisclosureChoice(choice);
  return choice === 'accept';
}
