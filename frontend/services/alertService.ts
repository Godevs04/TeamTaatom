import { Alert } from 'react-native';
import { sanitizeErrorForDisplay, sanitizeErrorMessage } from '../utils/errorSanitizer';

export interface AlertConfig {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

class AlertService {
  private static instance: AlertService;
  private alertQueue: AlertConfig[] = [];
  private isShowingAlert = false;

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  // Show custom alert with configuration
  showAlert(config: AlertConfig): void {
    this.alertQueue.push(config);
    this.processQueue();
  }

  // Process alert queue
  private processQueue(): void {
    if (this.isShowingAlert || this.alertQueue.length === 0) {
      return;
    }

    const config = this.alertQueue.shift();
    if (!config) return;

    this.isShowingAlert = true;

    const buttons = [];

    if (config.showCancel) {
      buttons.push({
        text: config.cancelText || 'Cancel',
        style: 'cancel' as const,
        onPress: () => {
          this.isShowingAlert = false;
          if (config.onCancel) config.onCancel();
          this.processQueue();
        },
      });
    }

    buttons.push({
      text: config.confirmText || 'OK',
      onPress: () => {
        this.isShowingAlert = false;
        if (config.onConfirm) config.onConfirm();
        this.processQueue();
      },
    });

    Alert.alert(config.title, config.message, buttons);
  }

  // Convenience methods
  showSuccess(title: string, message: string, onConfirm?: () => void): void {
    this.showAlert({
      title,
      message,
      type: 'success',
      onConfirm,
    });
  }

  showError(title: string, message: string, onConfirm?: () => void): void {
    // Sanitize error messages to hide technical details in production
    const sanitizedMessage = sanitizeErrorForDisplay(message, 'AlertService.showError');
    this.showAlert({
      title,
      message: sanitizedMessage,
      type: 'error',
      onConfirm,
    });
  }

  showWarning(title: string, message: string, onConfirm?: () => void): void {
    this.showAlert({
      title,
      message,
      type: 'warning',
      onConfirm,
    });
  }

  showInfo(title: string, message: string, onConfirm?: () => void): void {
    this.showAlert({
      title,
      message,
      type: 'info',
      onConfirm,
    });
  }

  showConfirmation(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    this.showAlert({
      title,
      message,
      showCancel: true,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm,
      onCancel,
    });
  }

  // Alias for showConfirmation to match AlertContext expectations
  showConfirm(
    message: string,
    onConfirm: () => void,
    title?: string,
    confirmText?: string,
    cancelText?: string
  ): void {
    this.showAlert({
      title: title || 'Confirm',
      message,
      showCancel: true,
      confirmText: confirmText || 'Confirm',
      cancelText: cancelText || 'Cancel',
      onConfirm,
    });
  }

  showDestructiveConfirm(
    message: string,
    onConfirm: () => void,
    title?: string,
    confirmText?: string,
    cancelText?: string
  ): void {
    this.showAlert({
      title: title || 'Confirm',
      message,
      showCancel: true,
      confirmText: confirmText || 'Delete',
      cancelText: cancelText || 'Cancel',
      onConfirm,
      type: 'error',
    });
  }

  showOptions(
    title: string,
    options: any[],
    message?: string,
    showCancel?: boolean,
    cancelText?: string
  ): void {
    // For now, just show a simple alert since we don't have CustomOptions implemented
    this.showAlert({
      title,
      message: message || 'Select an option',
      showCancel: showCancel || false,
      cancelText: cancelText || 'Cancel',
    });
  }

  showInput(
    message: string,
    onConfirm: (text: string) => void,
    title?: string,
    placeholder?: string,
    defaultValue?: string
  ): void {
    // For now, just show a simple alert since we don't have input functionality
    this.showAlert({
      title: title || 'Input',
      message,
      onConfirm: () => onConfirm(defaultValue || ''),
    });
  }

  // Methods for AlertContext integration (placeholder implementations)
  subscribe(callback: (state: any) => void): () => void {
    // Placeholder - return unsubscribe function
    return () => {};
  }

  subscribeToOptions(callback: (state: any) => void): () => void {
    // Placeholder - return unsubscribe function
    return () => {};
  }

  hideAlert(): void {
    this.clearQueue();
  }

  hideOptions(): void {
    // Placeholder implementation
  }

  // Clear all pending alerts
  clearQueue(): void {
    this.alertQueue = [];
    this.isShowingAlert = false;
  }
}

export default AlertService.getInstance();