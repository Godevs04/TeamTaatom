import { Redirect } from 'expo-router';

export default function Index() {
  // Simply redirect to signin - auth state is handled in _layout.tsx
  return <Redirect href="/(auth)/signin" />;
}
