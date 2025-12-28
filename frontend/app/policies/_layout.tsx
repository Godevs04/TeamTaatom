import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function PoliciesLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        presentation: 'card',
      }}
    >
      <Stack.Screen name="privacy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="copyright" />
    </Stack>
  );
}

