/**
 * PWA工具函数
 * 处理Service Worker注册、安装提示、推送通知等
 */

// Service Worker注册状态
let registration: ServiceWorkerRegistration | null = null;

/**
 * 注册Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // 检查浏览器是否支持Service Worker
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker not supported');
    return null;
  }

  try {
    // 先清理旧缓存
    await clearOldCaches();

    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('[PWA] Service Worker registered:', registration);

    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration!.installing;
      console.log('[PWA] New Service Worker found');

      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 有新版本可用
          console.log('[PWA] New version available');
          showUpdateNotification();
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

import { dialogService } from '../services/dialogService';

/**
 * 显示更新通知
 */
async function showUpdateNotification() {
  const confirmed = await dialogService.confirm('发现新版本，是否立即更新？', {
    title: '应用更新',
    type: 'info'
  });

  if (confirmed) {
    // 告诉新的Service Worker跳过等待
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
}

/**
 * 请求推送通知权限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[PWA] Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * 订阅推送通知
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!registration) {
    console.error('[PWA] Service Worker not registered');
    return null;
  }

  try {
    // 请求权限
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[PWA] Notification permission denied');
      return null;
    }

    // 订阅推送
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([0]) as any // 临时修复TypeScript错误
    });

    console.log('[PWA] Push subscription:', subscription);

    // 将订阅信息发送到服务器
    await sendSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error('[PWA] Push subscription failed:', error);
    return null;
  }
}

/**
 * 发送订阅信息到服务器
 */
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    });

    if (!response.ok) {
      throw new Error('Failed to send subscription to server');
    }

    console.log('[PWA] Subscription sent to server');
  } catch (error) {
    console.error('[PWA] Failed to send subscription:', error);
  }
}

/**
 * 显示本地通知（测试用）
 */
export async function showLocalNotification(title: string, body: string): Promise<void> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return;
  }

  if (!registration) {
    // 如果没有Service Worker，使用浏览器原生通知
    new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png'
    });
  } else {
    // 使用Service Worker显示通知
    await registration.showNotification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      // vibrate: [200, 100, 200], // 暂时注释以避免TypeScript错误
      tag: 'funnypixels-notification'
    });
  }
}

/**
 * 检查是否可以安装PWA
 */
let deferredPrompt: any = null;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 阻止默认的安装提示
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');

    // 显示自定义的安装按钮
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    deferredPrompt = null;
  });
}

/**
 * 显示安装按钮
 */
function showInstallButton() {
  const installButton = document.getElementById('pwa-install-button');
  if (installButton) {
    installButton.style.display = 'block';
  }

  // 触发自定义事件，通知React组件
  window.dispatchEvent(new CustomEvent('pwa-installable'));
}

/**
 * 触发PWA安装
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    console.warn('[PWA] Install prompt not available');
    return false;
  }

  // 显示安装提示
  deferredPrompt.prompt();

  // 等待用户响应
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[PWA] Install outcome:', outcome);

  deferredPrompt = null;

  return outcome === 'accepted';
}

/**
 * 检查是否在standalone模式运行（已安装为PWA）
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * 获取缓存大小
 */
export async function getCacheSize(): Promise<number> {
  if (!registration) {
    return 0;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      resolve(event.data.cacheSize);
    };

    registration.active?.postMessage(
      { type: 'GET_CACHE_SIZE' },
      [messageChannel.port2]
    );
  });
}

/**
 * 清除缓存
 */
export async function clearCache(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[PWA] Cache cleared');
  }
}

/**
 * 清理旧缓存（保留当前版本的缓存）
 */
export async function clearOldCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    const currentVersion = localStorage.getItem('funnypixels-cache-version');

    await Promise.all(
      cacheNames
        .filter(name => {
          // 保留当前版本和运行时缓存
          return name !== `funnypixels-${currentVersion}` &&
                 name !== 'funnypixels-runtime';
        })
        .map(name => {
          console.log('[PWA] Deleting old cache:', name);
          return caches.delete(name);
        })
    );

    // 更新当前版本号
    const newVersion = Date.now().toString();
    localStorage.setItem('funnypixels-cache-version', newVersion);
  }
}

/**
 * 工具函数：将base64转换为Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * 后台同步（用于离线时保存数据）
 */
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!registration || !('sync' in registration)) {
    console.warn('[PWA] Background Sync not supported');
    return;
  }

  try {
    await (registration as any).sync?.register(tag);
    console.log('[PWA] Background sync registered:', tag);
  } catch (error) {
    console.error('[PWA] Background sync registration failed:', error);
  }
}

/**
 * 初始化PWA功能
 */
export async function initPWA() {
  console.log('[PWA] Initializing...');

  // 注册Service Worker
  await registerServiceWorker();

  // 设置安装提示
  setupInstallPrompt();

  // 如果已安装，显示欢迎消息
  if (isStandalone()) {
    console.log('[PWA] Running in standalone mode');
  }

  console.log('[PWA] Initialized');
}
