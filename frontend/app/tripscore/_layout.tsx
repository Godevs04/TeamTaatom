import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function TripScoreLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        presentation: 'card',
      }}
    >
      <Stack.Screen name="continents" />
      <Stack.Screen name="continents/[continent]/countries" />
      <Stack.Screen name="countries/[country]" />
      <Stack.Screen name="countries/[country]/locations" />
      <Stack.Screen name="countries/[country]/locations/[location]" />
      <Stack.Screen name="countries/[country]/map" />
    </Stack>
  );
}

