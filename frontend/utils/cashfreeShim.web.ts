// Web stub for Cashfree PG SDK.
// The native SDK (`react-native-cashfree-pg-sdk`) does
// `import { version } from '../package.json'` internally, which Metro's web
// bundler can't resolve. The SDK is also useless on web (no NativeModules).
// All call sites already gate on `NativeModules.CashfreePgApi`, so these
// stubs are only here to satisfy the type system and the static import graph.

export type CFErrorResponse = {
  getMessage?: () => string;
  getCode?: () => string;
  getStatus?: () => string;
};

export const CFPaymentGatewayService = {
  setCallback: (_cb: unknown) => {},
  removeCallback: () => {},
  doSubscriptionPayment: (_session: unknown) => {
    throw new Error('Cashfree native SDK is not available on web');
  },
  doPayment: (_payment: unknown) => {
    throw new Error('Cashfree native SDK is not available on web');
  },
  doWebPayment: (_session: unknown) => {
    throw new Error('Cashfree native SDK is not available on web');
  },
};

export const CFEnvironment = {
  SANDBOX: 'SANDBOX',
  PRODUCTION: 'PRODUCTION',
} as const;

export class CFSubscriptionSession {
  constructor(..._args: unknown[]) {}
}

export class CFSession {
  constructor(..._args: unknown[]) {}
}

export class CFDropCheckoutPayment {
  constructor(..._args: unknown[]) {}
}
