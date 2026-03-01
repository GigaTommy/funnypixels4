import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'warning' | 'danger' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = '确认',
  cancelText = '取消',
  isLoading = false
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-100',
          confirmBg: 'bg-red-500 hover:bg-red-600',
          borderColor: 'border-red-200'
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-600" />,
          iconBg: 'bg-green-100',
          confirmBg: 'bg-green-500 hover:bg-green-600',
          borderColor: 'border-green-200'
        };
      case 'info':
        return {
          icon: <Info className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-100',
          confirmBg: 'bg-blue-500 hover:bg-blue-600',
          borderColor: 'border-blue-200'
        };
      default: // warning
        return {
          icon: <AlertTriangle className="w-6 h-6 text-orange-600" />,
          iconBg: 'bg-orange-100',
          confirmBg: 'bg-orange-500 hover:bg-orange-600',
          borderColor: 'border-orange-200'
        };
    }
  };

  const styles = getTypeStyles();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        key="confirm-dialog"
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10000,
          padding: '16px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl p-6 w-full max-w-md"
          style={{ 
            backgroundColor: 'white', 
            borderRadius: '16px', 
            padding: '24px', 
            width: '100%', 
            maxWidth: '448px',
            position: 'relative',
            zIndex: 10001
          }}
        >
          {/* 头部 */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 ${styles.iconBg} rounded-full flex items-center justify-center`}>
              {styles.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              disabled={isLoading}
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* 内容 */}
          <div className="mb-6">
            <p className="text-gray-600 leading-relaxed">{message}</p>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 py-3 px-4 ${styles.confirmBg} text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  处理中...
                </span>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
