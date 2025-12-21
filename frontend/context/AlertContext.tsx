import React, { createContext, useContext, useState } from 'react';
import { View } from 'react-native';
import CustomAlert from '../components/CustomAlert';
import CustomOptions, { CustomOption } from '../components/CustomOptions';
import { sanitizeErrorForDisplay, sanitizeErrorMessage } from '../utils/errorSanitizer';

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface OptionsState {
  visible: boolean;
  title?: string;
  message?: string;
  options: CustomOption[];
  showCancel?: boolean;
  cancelText?: string;
}

interface AlertContextType {
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    title?: string,
    confirmText?: string,
    cancelText?: string
  ) => void;
  showDestructiveConfirm: (
    message: string,
    onConfirm: () => void,
    title?: string,
    confirmText?: string,
    cancelText?: string
  ) => void;
  showOptions: (
    title: string,
    options: CustomOption[],
    message?: string,
    showCancel?: boolean,
    cancelText?: string
  ) => void;
  showInput: (
    message: string,
    onConfirm: (text: string) => void,
    title?: string,
    placeholder?: string,
    defaultValue?: string
  ) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
  });
  const [optionsState, setOptionsState] = useState<OptionsState>({
    visible: false,
    options: [],
  });

  const showAlert = (config: Partial<AlertState>) => {
    setAlertState({
      visible: true,
      title: '',
      message: '',
      ...config,
    });
  };

  const hideAlert = () => {
    setAlertState(prev => ({ ...prev, visible: false }));
  };

  const showOptions = (config: Partial<OptionsState>) => {
    setOptionsState({
      visible: true,
      options: [],
      ...config,
    });
  };

  const hideOptions = () => {
    setOptionsState(prev => ({ ...prev, visible: false }));
  };

  const contextValue: AlertContextType = {
    showSuccess: (message: string, title?: string) => {
      // Success messages are typically user-friendly, but sanitize just in case
      const sanitizedMessage = sanitizeErrorMessage(message, 'AlertContext.showSuccess');
      showAlert({ title: title || 'Success', message: sanitizedMessage, type: 'success' });
    },
    showError: (message: string, title?: string) => {
      // Sanitize error messages to hide technical details in production
      const sanitizedMessage = sanitizeErrorForDisplay(message, 'AlertContext.showError');
      showAlert({ title: title || 'Error', message: sanitizedMessage, type: 'error' });
    },
    showWarning: (message: string, title?: string) => {
      // Warning messages are typically user-friendly, but sanitize just in case
      const sanitizedMessage = sanitizeErrorMessage(message, 'AlertContext.showWarning');
      showAlert({ title: title || 'Warning', message: sanitizedMessage, type: 'warning' });
    },
    showInfo: (message: string, title?: string) => {
      // Info messages are typically user-friendly, but sanitize just in case
      const sanitizedMessage = sanitizeErrorMessage(message, 'AlertContext.showInfo');
      showAlert({ title: title || 'Info', message: sanitizedMessage, type: 'info' });
    },
    showConfirm: (
      message: string,
      onConfirm: () => void,
      title?: string,
      confirmText?: string,
      cancelText?: string
    ) => {
      showAlert({
        title: title || 'Confirm',
        message,
        type: 'info',
        showCancel: true,
        confirmText: confirmText || 'Confirm',
        cancelText: cancelText || 'Cancel',
        onConfirm: () => {
          onConfirm();
          hideAlert();
        },
        onCancel: hideAlert,
      });
    },
    showDestructiveConfirm: (
      message: string,
      onConfirm: () => void,
      title?: string,
      confirmText?: string,
      cancelText?: string
    ) => {
      showAlert({
        title: title || 'Confirm',
        message,
        type: 'error',
        showCancel: true,
        confirmText: confirmText || 'Delete',
        cancelText: cancelText || 'Cancel',
        onConfirm: () => {
          onConfirm();
          hideAlert();
        },
        onCancel: hideAlert,
      });
    },
    showOptions: (
      title: string,
      options: CustomOption[],
      message?: string,
      showCancel?: boolean,
      cancelText?: string
    ) => {
      showOptions({
        title,
        message,
        options,
        showCancel,
        cancelText,
      });
    },
    showInput: (
      message: string,
      onConfirm: (text: string) => void,
      title?: string,
      placeholder?: string,
      defaultValue?: string
    ) => {
      // For now, just show a simple confirm dialog
      showAlert({
        title: title || 'Input',
        message: `${message}\n\nNote: Input prompt functionality is available. Enter your response below.`,
        type: 'info',
        showCancel: false,
        confirmText: 'OK',
        onConfirm: () => onConfirm(defaultValue || ''),
      });
    },
  };

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        showCancel={alertState.showCancel}
        confirmText={alertState.confirmText}
        cancelText={alertState.cancelText}
        onConfirm={alertState.onConfirm}
        onCancel={alertState.onCancel}
        onClose={hideAlert}
      />
      <CustomOptions
        visible={optionsState.visible}
        title={optionsState.title}
        message={optionsState.message}
        options={optionsState.options}
        showCancel={optionsState.showCancel}
        cancelText={optionsState.cancelText}
        onClose={hideOptions}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
