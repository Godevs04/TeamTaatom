import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function SettingsLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="data" />
      <Stack.Screen name="about" />
      <Stack.Screen name="follow-requests" />
    </Stack>
  );
}
