import { Linking, Platform } from 'react-native';

/**
 * Directs the user to the system settings screen.
 * On Android, opens the application details page so they can change battery optimization status.
 * On iOS, opens the application settings page so they can enable "Always Allow" location settings.
 */
export async function openSystemSettingsForBackgroundTracking(): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL('app-settings:');
    if (supported && Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
      return true;
    }
    
    // Fallback/Android: open general application details/settings page
    await Linking.openSettings();
    return true;
  } catch (err) {
    console.warn('[BatteryOptimization] Failed to launch settings intent:', err);
    return false;
  }
}
