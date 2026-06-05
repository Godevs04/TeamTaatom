import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function NavigateLayout() {
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
      <Stack.Screen 
        name="tracking" 
        options={{ 
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }} 
      />
      <Stack.Screen name="complete" />
      <Stack.Screen name="detail" />
    </Stack>
  );
}
