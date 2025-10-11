import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface DialogConfig {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface AlertConfig {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface DialogContextType {
  confirm: (config: DialogConfig) => Promise<boolean>;
  alert: (config: AlertConfig) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<DialogConfig>({
    message: '',
  });
  const [isAlert, setIsAlert] = useState(false);
  const [resolveCallback, setResolveCallback] = useState<((value: boolean) => void) | null>(null);
  const [alertResolve, setAlertResolve] = useState<(() => void) | null>(null);

  const confirm = useCallback((dialogConfig: DialogConfig): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig(dialogConfig);
      setIsAlert(false);
      setIsOpen(true);
      setResolveCallback(() => resolve);
    });
  }, []);

  const alert = useCallback((alertConfig: AlertConfig): Promise<void> => {
    return new Promise((resolve) => {
      setConfig({
        ...alertConfig,
        confirmText: alertConfig.buttonText || 'OK',
      });
      setIsAlert(true);
      setIsOpen(true);
      setAlertResolve(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (isAlert && alertResolve) {
      alertResolve();
      setAlertResolve(null);
    } else if (resolveCallback) {
      resolveCallback(true);
      setResolveCallback(null);
    }
  }, [isAlert, resolveCallback, alertResolve]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolveCallback) {
      resolveCallback(false);
      setResolveCallback(null);
    }
  }, [resolveCallback]);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      <ConfirmDialog
        isOpen={isOpen}
        title={config.title}
        message={config.message}
        confirmText={config.confirmText}
        cancelText={isAlert ? undefined : config.cancelText}
        variant={config.variant || 'warning'}
        onConfirm={handleConfirm}
        onCancel={isAlert ? handleConfirm : handleCancel}
      />
    </DialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useConfirmDialog must be used within a DialogProvider');
  }
  return context;
}
