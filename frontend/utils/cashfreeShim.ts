// Native platform wrapper for Cashfree PG SDK.
// Metro picks cashfreeShim.web.ts for web builds.
//
// Do not static-import `react-native-cashfree-pg-sdk`: it constructs
// `CFPaymentGatewayService` at module load, whose constructor uses
// `NativeEventEmitter(NativeModules.CashfreeEventEmitter)` and throws in Expo Go
// before any screen can export a default component.

import { NativeModules } from 'react-native';
import type { CFSubscriptionSession, CFSession, CFDropCheckoutPayment } from 'cashfree-pg-api-contract';

export { CFEnvironment, CFSubscriptionSession, CFSession, CFDropCheckoutPayment } from 'cashfree-pg-api-contract';

export type CFErrorResponse = {
  getMessage?: () => string;
  getCode?: () => string;
  getStatus?: () => string;
};

type CashfreeCallback = {
  onVerify(orderID: string): void;
  onError(error: CFErrorResponse, orderID: string): void;
};

type NativePaymentService = {
  setCallback: (cb: CashfreeCallback) => void;
  removeCallback: () => void;
  doSubscriptionPayment: (session: CFSubscriptionSession) => void;
  doPayment: (payment: CFDropCheckoutPayment) => void;
  doWebPayment: (session: CFSession) => void;
};

function getNativePaymentService(): NativePaymentService | null {
  if (!NativeModules.CashfreePgApi) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-cashfree-pg-sdk') as {
      CFPaymentGatewayService: NativePaymentService;
    };
    return mod.CFPaymentGatewayService;
  } catch {
    return null;
  }
}

export const CFPaymentGatewayService = {
  setCallback(cb: CashfreeCallback) {
    const s = getNativePaymentService();
    if (s) s.setCallback(cb);
  },
  removeCallback() {
    const s = getNativePaymentService();
    if (s) s.removeCallback();
  },
  doSubscriptionPayment(session: CFSubscriptionSession) {
    const s = getNativePaymentService();
    if (!s) {
      throw new Error('Cashfree native SDK is not linked');
    }
    s.doSubscriptionPayment(session);
  },
  /** Launch the Cashfree drop-in checkout for one-time payments. */
  doPayment(session: CFSession) {
    const s = getNativePaymentService();
    if (!s) {
      throw new Error('Cashfree native SDK is not linked');
    }
    // We must wrap the session in a CFDropCheckoutPayment object,
    // otherwise the Cashfree SDK receives raw session properties and fails to render
    // the payment flow.
    const { CFDropCheckoutPayment } = require('cashfree-pg-api-contract');
    const payment = new CFDropCheckoutPayment(session, null, null);
    s.doPayment(payment);
  },
  doWebPayment(session: CFSession) {
    const s = getNativePaymentService();
    if (!s) {
      throw new Error('Cashfree native SDK is not linked');
    }
    s.doWebPayment(session);
  },
};

