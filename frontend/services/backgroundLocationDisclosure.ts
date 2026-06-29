/**
 * Prominent disclosure gate for Android/iOS background location (Google Play User Data policy).
 * A host component registers the UI; journey code awaits consent before calling
 * requestBackgroundPermissionsAsync().
 */

export type BackgroundLocationDisclosureResult = 'accept' | 'decline';

type DisclosureHandler = () => Promise<BackgroundLocationDisclosureResult>;

let disclosureHandler: DisclosureHandler | null = null;

export function registerBackgroundLocationDisclosureHandler(handler: DisclosureHandler | null): void {
  disclosureHandler = handler;
}

/**
 * Shows the in-app prominent disclosure before requesting background location.
 * Returns true when the user agreed to proceed to the system permission dialog.
 */
export async function ensureBackgroundLocationDisclosure(): Promise<boolean> {
  if (!disclosureHandler) {
    // Fail closed: do not request background location without disclosure UI.
    return false;
  }

  const choice = await disclosureHandler();
  return choice === 'accept';
}
