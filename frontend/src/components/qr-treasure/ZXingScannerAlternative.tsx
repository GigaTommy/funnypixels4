import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader, Result, DecodeHintType, BarcodeFormat } from '@zxing/library';
import qrTreasureService, { ScanResult } from '../../services/qrTreasureService';
import { logger } from '../../utils/logger';

interface ZXingScannerAlternativeProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ZXingScannerAlternative: React.FC<ZXingScannerAlternativeProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取用户位置
  const getUserLocation = useCallback(async (): Promise<{lat: number, lng: number}> => {
    if (userLocation) return userLocation;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000
          }
        );
      });

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      setUserLocation(location);
      logger.info('位置获取成功:', location);
      return location;
    } catch (err) {
      logger.warn('位置获取失败，使用默认位置:', err);
      const defaultLocation = { lat: 39.9042, lng: 116.4074 };
      setUserLocation(defaultLocation);
      return defaultLocation;
    }
  }, [userLocation]);

  // 初始化ZXing
  const initializeZXing = useCallback(() => {
    logger.info('初始化ZXing...');

    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (err) {
        logger.warn('重置ZXing失败:', err);
      }
    }

    // 使用最基本的配置
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);

    readerRef.current = new BrowserMultiFormatReader(hints);
    logger.info('ZXing初始化完成');
  }, []);

  // 手动解码帧
  const decodeFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !readerRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return null;
    }

    try {
      // 设置canvas尺寸
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 绘制当前帧
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 获取图像数据
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // 尝试解码 - 暂时禁用
      // const result = readerRef.current!.decodeFromImage(imageData);
      // return result;
    } catch (err) {
      // 这是正常的，没有找到二维码
      return null;
    }
  }, []);

  // 启动扫描
  const startScanning = useCallback(async () => {
    logger.info('开始启动扫描...');
    setIsLoading(true);
    setError('');

    try {
      // 初始化ZXing
      initializeZXing();

      // 获取相机权限
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('设备不支持相机功能');
      }

      logger.info('请求相机权限...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      logger.info('相机权限获取成功');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });

        logger.info('视频元数据加载完成');
        await videoRef.current.play();
        logger.info('视频播放成功');

        // 开始扫描循环
        let scanCount = 0;
        scanIntervalRef.current = setInterval(() => {
          scanCount++;
          logger.debug(`扫描第${scanCount}帧...`);

          const result = decodeFrame();
          if (result) {
            logger.info('扫描成功:', result.getText());
            handleScanSuccess(result.getText());
          }

          // 每30秒输出一次状态，避免日志过多
          if (scanCount % 600 === 0) {
            logger.info('扫描状态正常，已扫描', scanCount, '帧');
          }
        }, 50); // 每50ms扫描一次（20fps）

        setIsLoading(false);
      }
    } catch (err) {
      logger.error('启动扫描失败:', err);
      setError(`启动失败: ${err}`);
      setIsLoading(false);
    }
  }, [initializeZXing, decodeFrame]);

  // 处理扫描成功
  const handleScanSuccess = useCallback(async (decodedText: string) => {
    logger.info('处理扫描成功:', decodedText);

    // 停止扫描
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    try {
      // 获取位置
      const location = await getUserLocation();

      // 调用API
      const result = await qrTreasureService.scanQRCode(
        decodedText,
        location.lat,
        location.lng
      );

      logger.info('API调用成功:', result);

      // 成功回调
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      logger.error('处理扫描结果失败:', err);
      setError(`处理失败: ${err}`);
    }
  }, [getUserLocation, onSuccess, onClose]);

  // 停止扫描
  const stopScanning = useCallback(() => {
    logger.info('停止扫描...');

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (err) {
        logger.warn('重置ZXing失败:', err);
      }
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }, []);

  // 组件生命周期
  useEffect(() => {
    if (isOpen) {
      logger.info('=== 打开扫描器 ===');
      startScanning();
    }

    return () => {
      logger.info('=== 关闭扫描器 ===');
      stopScanning();
    };
  }, [isOpen, startScanning, stopScanning]);

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  if (!isOpen) return null;

  return React.createElement('div', {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000000',
      zIndex: 100000
    }
  },
    // 视频元素
    React.createElement('video', {
      ref: videoRef,
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      },
      playsInline: true,
      muted: true
    }),

    // 隐藏的Canvas用于解码
    React.createElement('canvas', {
      ref: canvasRef,
      style: { display: 'none' }
    }),

    // 扫描框
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '280px',
        height: '280px',
        border: '3px solid #60a5fa',
        borderRadius: '12px',
        pointerEvents: 'none',
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
      }
    },
      // 扫描线
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '3px',
          background: 'linear-gradient(to right, transparent, #60a5fa, transparent)',
          animation: 'scan 2s infinite'
        }
      })
    ),

    // 顶部栏
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    },
      React.createElement('h1', {
        style: {
          color: 'white',
          fontSize: '18px',
          margin: 0,
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }
      }, '扫一扫'),

      React.createElement('button', {
        onClick: handleClose,
        style: {
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: '2px solid rgba(255,255,255,0.3)',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      },
        React.createElement('svg', {
          style: { width: '20px', height: '20px' },
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24'
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: 2,
            d: 'M6 18L18 6M6 6l12 12'
          })
        )
      )
    ),

    // 提示文字
    React.createElement('div', {
      style: {
        position: 'absolute',
        bottom: '100px',
        left: 0,
        right: 0,
        textAlign: 'center',
        color: 'white'
      }
    },
      React.createElement('p', {
        style: {
          fontSize: '18px',
          marginBottom: '8px',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }
      }, '将二维码放入框内，即可自动扫描'),
      React.createElement('p', {
        style: {
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.7)'
        }
      }, '支持二维码和条形码')
    ),

    // 加载状态
    isLoading && React.createElement('div', {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        color: 'white'
      }
    },
      React.createElement('div', {
        style: {
          width: '48px',
          height: '48px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTopColor: 'white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }
      }),
      React.createElement('p', null, '正在启动相机...')
    ),

    // 错误提示
    error && React.createElement('div', {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(239,68,68,0.9)',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '8px',
        textAlign: 'center',
        maxWidth: '80%'
      }
    },
      React.createElement('p', { style: { marginBottom: '12px' } }, error),
      React.createElement('button', {
        onClick: () => {
          setError('');
          startScanning();
        },
        style: {
          backgroundColor: 'white',
          color: '#ef4444',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer'
        }
      }, '重试')
    ),

    // 调试信息
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: '70px',
        left: '16px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#10b981',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontFamily: 'monospace'
      }
    }, '打开控制台查看详细日志'),

    // CSS动画
    React.createElement('style', {
      dangerouslySetInnerHTML: {
        __html: `
          @keyframes scan {
            0% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(277px); opacity: 0.8; }
            100% { transform: translateY(0); opacity: 1; }
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }
    })
  );
};

export default ZXingScannerAlternative;