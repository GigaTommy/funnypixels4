// 弹窗管理服务 - 替代浏览器原生的alert、confirm、prompt

interface DialogOptions {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  confirmText?: string;
  cancelText?: string;
}

interface InputDialogOptions extends DialogOptions {
  placeholder?: string;
  defaultValue?: string;
  inputType?: 'text' | 'number';
}

interface DialogState {
  alert: {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    onClose: () => void;
  } | null;
  confirm: {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info' | 'success';
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null;
  input: {
    isOpen: boolean;
    title: string;
    message: string;
    placeholder: string;
    defaultValue: string;
    inputType: 'text' | 'number';
    confirmText: string;
    cancelText: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
  } | null;
}

class DialogService {
  private state: DialogState = {
    alert: null,
    confirm: null,
    input: null
  };

  private listeners: Set<() => void> = new Set();

  // 添加状态监听器
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 通知状态变化
  private notify() {
    this.listeners.forEach(listener => listener());
  }

  // 获取当前状态
  getState(): DialogState {
    return this.state;
  }

  // 显示警告弹窗（替代alert）
  alert(message: string, options: Partial<DialogOptions> = {}): Promise<void> {
    return new Promise((resolve) => {
      this.state.alert = {
        isOpen: true,
        title: options.title || '提示',
        message,
        type: options.type || 'info',
        onClose: () => {
          this.state.alert = null;
          this.notify();
          resolve();
        }
      };
      this.notify();
    });
  }

  // 显示确认弹窗（替代confirm）
  confirm(message: string, options: Partial<DialogOptions> = {}): Promise<boolean> {
    return new Promise((resolve) => {
      this.state.confirm = {
        isOpen: true,
        title: options.title || '确认',
        message,
        type: options.type as any || 'warning',
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || '取消',
        onConfirm: () => {
          this.state.confirm = null;
          this.notify();
          resolve(true);
        },
        onCancel: () => {
          this.state.confirm = null;
          this.notify();
          resolve(false);
        }
      };
      this.notify();
    });
  }

  // 显示输入弹窗（替代prompt）
  prompt(message: string, options: Partial<InputDialogOptions> = {}): Promise<string | null> {
    return new Promise((resolve) => {
      this.state.input = {
        isOpen: true,
        title: options.title || '输入',
        message,
        placeholder: options.placeholder || '',
        defaultValue: options.defaultValue || '',
        inputType: options.inputType || 'text',
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || '取消',
        onConfirm: (value: string) => {
          this.state.input = null;
          this.notify();
          resolve(value);
        },
        onCancel: () => {
          this.state.input = null;
          this.notify();
          resolve(null);
        }
      };
      this.notify();
    });
  }

  // 显示成功消息
  success(message: string, title?: string): Promise<void> {
    return this.alert(message, { title: title || '成功', type: 'success' });
  }

  // 显示错误消息
  error(message: string, title?: string): Promise<void> {
    return this.alert(message, { title: title || '错误', type: 'error' });
  }

  // 显示警告消息
  warning(message: string, title?: string): Promise<void> {
    return this.alert(message, { title: title || '警告', type: 'warning' });
  }

  // 显示信息消息
  info(message: string, title?: string): Promise<void> {
    return this.alert(message, { title: title || '信息', type: 'info' });
  }

  // 显示删除确认对话框
  confirmDelete(itemName: string = '此项目'): Promise<boolean> {
    return this.confirm(
      `确定要删除${itemName}吗？此操作不可撤销。`,
      {
        title: '确认删除',
        type: 'error',
        confirmText: '删除',
        cancelText: '取消'
      }
    );
  }
}

// 创建全局实例
export const dialogService = new DialogService();

// 导出类型
export type { DialogState, DialogOptions, InputDialogOptions };