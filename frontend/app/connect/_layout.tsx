import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function ConnectLayout() {
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
      <Stack.Screen name="page/[id]" />
      <Stack.Screen name="create" />
      <Stack.Screen name="search" />
      <Stack.Screen name="editContent" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="preview" />
    </Stack>
  );
}
