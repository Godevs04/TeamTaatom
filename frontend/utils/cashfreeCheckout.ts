import { CFEnvironment } from './cashfreeShim';

/** Match backend CASHFREE_ENV — never infer from __DEV__ alone (release builds often hit sandbox API). */
export function resolveCashfreeEnvironment(serverEnv?: string): CFEnvironment {
  const normalized = (serverEnv || '').toLowerCase();
  if (normalized === 'production') return CFEnvironment.PRODUCTION;
  if (normalized === 'sandbox') return CFEnvironment.SANDBOX;
  return __DEV__ ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION;
}
