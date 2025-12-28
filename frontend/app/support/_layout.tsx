import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function SupportLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        presentation: 'card',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="help" />
      <Stack.Screen name="contact" />
    </Stack>
  );
}

