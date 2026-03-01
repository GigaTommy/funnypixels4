/**
 * PWA安装提示组件
 * 当用户可以安装PWA时显示安装按钮
 */

import { useState, useEffect } from 'react';
import { promptInstall, isStandalone } from '../utils/pwa';

export default function PWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 检查是否已安装
    setIsInstalled(isStandalone());

    // 监听PWA可安装事件
    const handleInstallable = () => {
      setCanInstall(true);
    };

    window.addEventListener('pwa-installable', handleInstallable);

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
    };
  }, []);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setCanInstall(false);
      setIsInstalled(true);
    }
  };

  // 如果已安装或不可安装，不显示按钮
  if (isInstalled || !canInstall) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-auto">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm mb-1">
            安装 FunnyPixels 应用
          </p>
          <p className="text-xs opacity-90">
            获得更好的体验，支持离线使用
          </p>
        </div>

        <button
          onClick={handleInstall}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          立即安装
        </button>

        <button
          onClick={() => setCanInstall(false)}
          className="text-white/80 hover:text-white p-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
