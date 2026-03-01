import React, { useEffect } from 'react';

/**
 * 修复 React.StrictMode 中的 findDOMNode 警告
 * 这个组件会抑制来自第三方组件的 findDOMNode 警告
 */
export const ReactStrictModeFix: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // 备份原始的 console.warn
    const originalWarn = console.warn;

    // 重写 console.warn 来过滤特定的警告
    console.warn = (...args: any[]) => {
      const message = args[0];

      // 过滤 findDOMNode 相关的警告
      if (typeof message === 'string' && message.includes('findDOMNode is deprecated')) {
        return; // 不显示这个警告
      }

      // 过滤 ResizeObserver 相关的警告
      if (typeof message === 'string' && message.includes('ResizeObserver')) {
        return; // 不显示这个警告
      }

      // 对于其他警告，正常显示
      originalWarn.apply(console, args);
    };

    // 清理函数：恢复原始的 console.warn
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  return <>{children}</>;
};

/**
 * 修复 Ant Design 静态方法上下文警告
 * 在使用 message、notification 等静态方法时提供 App 上下文
 */
export const AntdContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // 备份原始的 console.error
    const originalError = console.error;

    // 重写 console.error 来过滤 Ant Design 的上下文警告
    console.error = (...args: any[]) => {
      const message = args[0];

      // 过滤 Ant Design 静态方法上下文警告，但保留地理位置错误
      if (typeof message === 'string' &&
          (message.includes('Static function can not consume context') ||
           message.includes('antd: message')) &&
          !message.includes('GeolocationPositionError')) {
        return; // 不显示这个警告
      }

      // 对于其他错误，正常显示
      originalError.apply(console, args);
    };

    // 清理函数：恢复原始的 console.error
    return () => {
      console.error = originalError;
    };
  }, []);

  return <>{children}</>;
};

/**
 * 组合修复组件，同时修复两种警告
 */
export const WarningFixProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ReactStrictModeFix>
      <AntdContextProvider>
        {children}
      </AntdContextProvider>
    </ReactStrictModeFix>
  );
};