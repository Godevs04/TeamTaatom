/**
 * Global alert handler so non-React code (services, utils) can show the app's CustomAlert.
 * AlertProvider registers its showAlert when it mounts.
 */

export interface GlobalAlertConfig {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

let handler: ((config: GlobalAlertConfig) => void) | null = null;

export function registerGlobalAlertHandler(h: (config: GlobalAlertConfig) => void): void {
  handler = h;
}

export function showGlobalAlert(config: GlobalAlertConfig): void {
  if (handler) handler(config);
}
