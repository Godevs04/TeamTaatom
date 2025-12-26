import { Redirect } from 'expo-router';

/**
 * Web route: /help
 * Redirects to /support/help for consistency
 */
export default function HelpRedirect() {
  return <Redirect href="/support/help" />;
}

