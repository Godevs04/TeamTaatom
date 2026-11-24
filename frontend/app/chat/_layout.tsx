import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack id={undefined}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="thread" />
      <Stack.Screen name="group-info" options={{ presentation: 'card' }} />
    </Stack>
  );
}
