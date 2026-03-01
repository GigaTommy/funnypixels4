import React, { useState, useEffect } from 'react';
import { dialogService, DialogState } from '../../services/dialogService';
import ConfirmDialog from './ConfirmDialog';
import InputDialog from './InputDialog';

// 简化的AlertDialog组件
interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onClose}
      title={title}
      message={message}
      type={type as any}
      confirmText="确定"
      cancelText=""
    />
  );
};

// 全局弹窗管理组件
export const GlobalDialogs: React.FC = () => {
  const [state, setState] = useState<DialogState>(dialogService.getState());

  useEffect(() => {
    const unsubscribe = dialogService.subscribe(() => {
      setState(dialogService.getState());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      {/* Alert Dialog */}
      {state.alert && (
        <AlertDialog
          isOpen={state.alert.isOpen}
          onClose={state.alert.onClose}
          title={state.alert.title}
          message={state.alert.message}
          type={state.alert.type}
        />
      )}

      {/* Confirm Dialog */}
      {state.confirm && (
        <ConfirmDialog
          isOpen={state.confirm.isOpen}
          onClose={state.confirm.onCancel}
          onConfirm={state.confirm.onConfirm}
          title={state.confirm.title}
          message={state.confirm.message}
          type={state.confirm.type}
          confirmText={state.confirm.confirmText}
          cancelText={state.confirm.cancelText}
        />
      )}

      {/* Input Dialog */}
      {state.input && (
        <InputDialog
          isOpen={state.input.isOpen}
          onClose={state.input.onCancel}
          onConfirm={state.input.onConfirm}
          title={state.input.title}
          message={state.input.message}
          placeholder={state.input.placeholder}
          defaultValue={state.input.defaultValue}
          type={state.input.inputType}
          confirmText={state.input.confirmText}
          cancelText={state.input.cancelText}
        />
      )}
    </>
  );
};

export default GlobalDialogs;