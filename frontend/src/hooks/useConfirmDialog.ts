import { useState, useCallback } from 'react';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  confirmText: string;
  cancelText: string;
  onConfirm: (() => void) | null;
}

export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    confirmText: '确认',
    cancelText: '取消',
    onConfirm: null
  });

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      type?: 'warning' | 'danger' | 'info' | 'success';
      confirmText?: string;
      cancelText?: string;
    }
  ) => {
    setDialogState({
      isOpen: true,
      title,
      message,
      type: options?.type || 'warning',
      confirmText: options?.confirmText || '确认',
      cancelText: options?.cancelText || '取消',
      onConfirm
    });
  }, []);

  const hideDialog = useCallback(() => {
    setDialogState(prev => ({
      ...prev,
      isOpen: false,
      onConfirm: null
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (dialogState.onConfirm) {
      dialogState.onConfirm();
    }
    hideDialog();
  }, [dialogState.onConfirm, hideDialog]);

  return {
    dialogState,
    showConfirm,
    hideDialog,
    handleConfirm
  };
};
