import React, { createContext, useContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import CustomAlert, { CustomAlertButton } from '../components/CustomAlert';
import CustomOptions, { CustomOption } from '../components/CustomOptions';
import AlertService from '../services/alertService';

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
    message: '',
  });
  const [optionsState, setOptionsState] = useState<OptionsState>({
    visible: false,
    options: [],
  });

  useEffect(() => {
    const unsubscribe = AlertService.subscribe((state) => {
      setAlertState(state);
    });

    const unsubscribeOptions = AlertService.subscribeToOptions((state) => {
      setOptionsState(state);
    });

    return () => {
      unsubscribe();
      unsubscribeOptions();
    };
  }, []);

  const contextValue: AlertContextType = {
    showSuccess: AlertService.showSuccess.bind(AlertService),
    showError: AlertService.showError.bind(AlertService),
    showWarning: AlertService.showWarning.bind(AlertService),
    showInfo: AlertService.showInfo.bind(AlertService),
    showConfirm: AlertService.showConfirm.bind(AlertService),
    showDestructiveConfirm: AlertService.showDestructiveConfirm.bind(AlertService),
    showOptions: AlertService.showOptions.bind(AlertService),
    showInput: AlertService.showInput.bind(AlertService),
  };

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        type={alertState.type}
        showIcon={alertState.showIcon}
        onClose={() => AlertService.hideAlert()}
      />
      <CustomOptions
        visible={optionsState.visible}
        title={optionsState.title}
        message={optionsState.message}
        options={optionsState.options}
        showCancel={optionsState.showCancel}
        cancelText={optionsState.cancelText}
        onClose={() => AlertService.hideOptions()}
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
