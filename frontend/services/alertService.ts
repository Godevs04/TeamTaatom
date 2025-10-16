import { Alert } from 'react-native';
import CustomAlert, { CustomAlertButton } from '../components/CustomAlert';
import CustomOptions, { CustomOption } from '../components/CustomOptions';

interface AlertState {
  visible: boolean;
  title?: string;
  message: string;
  buttons?: CustomAlertButton[];
  type?: 'info' | 'success' | 'warning' | 'error';
  showIcon?: boolean;
}

interface OptionsState {
  visible: boolean;
  title?: string;
  message?: string;
  options: CustomOption[];
  showCancel?: boolean;
  cancelText?: string;
}

class AlertService {
  private static instance: AlertService;
  private alertState: AlertState = {
    visible: false,
    message: '',
  };
  private optionsState: OptionsState = {
    visible: false,
    options: [],
  };
  private listeners: Array<(state: AlertState) => void> = [];
  private optionsListeners: Array<(state: OptionsState) => void> = [];

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  subscribe(listener: (state: AlertState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  subscribeToOptions(listener: (state: OptionsState) => void): () => void {
    this.optionsListeners.push(listener);
    return () => {
      this.optionsListeners = this.optionsListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.alertState));
  }

  private notifyOptionsListeners(): void {
    this.optionsListeners.forEach(listener => listener(this.optionsState));
  }

  private showAlert(
    message: string,
    title?: string,
    buttons?: CustomAlertButton[],
    type?: 'info' | 'success' | 'warning' | 'error',
    showIcon?: boolean
  ): void {
    this.alertState = {
      visible: true,
      message,
      title,
      buttons: buttons || [{ text: 'OK' }],
      type: type || 'info',
      showIcon: showIcon !== false,
    };
    this.notifyListeners();
  }

  hideAlert(): void {
    this.alertState = { ...this.alertState, visible: false };
    this.notifyListeners();
  }

  hideOptions(): void {
    this.optionsState = { ...this.optionsState, visible: false };
    this.notifyOptionsListeners();
  }

  showSuccess(message: string, title?: string): void {
    this.showAlert(message, title || 'Success', [{ text: 'OK' }], 'success');
  }

  showError(message: string, title?: string): void {
    this.showAlert(message, title || 'Error', [{ text: 'OK' }], 'error');
  }

  showWarning(message: string, title?: string): void {
    this.showAlert(message, title || 'Warning', [{ text: 'OK' }], 'warning');
  }

  showInfo(message: string, title?: string): void {
    this.showAlert(message, title || 'Info', [{ text: 'OK' }], 'info');
  }

  showConfirm(
    message: string,
    onConfirm: () => void,
    title?: string,
    confirmText?: string,
    cancelText?: string
  ): void {
    this.showAlert(
      message,
      title || 'Confirm',
      [
        { text: cancelText || 'Cancel', style: 'cancel' },
        { text: confirmText || 'Confirm', onPress: onConfirm, style: 'default' }
      ],
      'info'
    );
  }

  showDestructiveConfirm(
    message: string,
    onConfirm: () => void,
    title?: string,
    confirmText?: string,
    cancelText?: string
  ): void {
    this.showAlert(
      message,
      title || 'Confirm',
      [
        { text: cancelText || 'Cancel', style: 'cancel' },
        { text: confirmText || 'Delete', onPress: onConfirm, style: 'destructive' }
      ],
      'warning'
    );
  }

  // Custom options picker
  showOptions(
    title: string,
    options: CustomOption[],
    message?: string,
    showCancel?: boolean,
    cancelText?: string
  ): void {
    this.optionsState = {
      visible: true,
      title,
      message,
      options,
      showCancel: showCancel !== false,
      cancelText: cancelText || 'Cancel',
    };
    this.notifyOptionsListeners();
  }

  // Custom input alert
  showInput(
    message: string,
    onConfirm: (text: string) => void,
    title?: string,
    placeholder?: string,
    defaultValue?: string
  ): void {
    // For now, we'll use a simple confirm dialog
    // In a real implementation, you'd create a custom input component
    this.showAlert(
      `${message}\n\nNote: Input functionality will be enhanced in future updates.`,
      title || 'Input Required',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'OK', 
          onPress: () => onConfirm(defaultValue || ''),
          style: 'default' 
        }
      ],
      'info'
    );
  }

  getCurrentState(): AlertState {
    return this.alertState;
  }

  getCurrentOptionsState(): OptionsState {
    return this.optionsState;
  }
}

export default AlertService.getInstance();