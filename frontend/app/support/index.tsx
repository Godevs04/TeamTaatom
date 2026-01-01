import { Redirect } from 'expo-router';

/**
 * Web route: /support
 * Redirects to /support/contact for consistency
 */
export default function SupportIndex() {
  return <Redirect href="/support/contact" />;
}

