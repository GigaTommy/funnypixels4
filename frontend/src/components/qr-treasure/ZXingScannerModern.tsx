import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader, Result, DecodeHintType, BarcodeFormat } from '@zxing/library';
import qrTreasureService, { ScanResult } from '../../services/qrTreasureService';
import HideTreasureForm from './HideTreasureForm';
import TreasureFoundCard from './TreasureFoundCard';
import TreasureNearbyCard from './TreasureNearbyCard';
import NoTreasureCard from './NoTreasureCard';
import { logger } from '../../utils/logger';

interface ZXingScannerModernProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'scan' | 'hide';
  onSuccess?: (result: string) => void;
  onViewBackpack?: () => void;
}

/**
 * 基于最新@zxing/library接口的现代化扫码组件
 * 使用手动帧捕获和解码方式，更稳定可靠
 */
const ZXingScannerModern: React.FC<ZXingScannerModernProps> = ({
  isOpen,
  onClose,
  initialMode = 'scan',
  onSuccess,
  onViewBackpack
}) => {
  const [mode, setMode] = useState<'scanning' | 'result' | 'hiding'>('scanning');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scannedQR, setScannedQR] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  // 只在开发环境启用调试模式
  const isDevelopment = import.meta.env.DEV;
  const [scanCount, setScanCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 响应式扫描框尺寸计算
  const getScanBoxSize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const minDimension = Math.min(width, height);

    if (minDimension < 400) return 200;
    if (minDimension < 600) return 240;
    if (minDimension < 800) return 280;
    if (minDimension < 1200) return 320;
    return 360;
  }, []);

  // 震动反馈
  const triggerVibration = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }, []);

  // 播放成功音效
  const playSuccessSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

      oscillator.type = 'sine';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch {
      // 忽略音频错误
    }
  }, []);

  // 获取用户位置
  const getUserLocationAsync = useCallback(async (): Promise<{lat: number, lng: number}> => {
    if (userLocation) return userLocation;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 8000,
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

  // 初始化ZXing阅读器
  const initializeReader = useCallback(() => {
    logger.info('📋 初始化ZXing阅读器...');

    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (err) {
        logger.warn('重置ZXing失败:', err);
      }
    }

    // 使用最新的解码配置
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.ASSUME_GS1, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.PDF_417,
      BarcodeFormat.AZTEC,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E
    ]);

    readerRef.current = new BrowserMultiFormatReader(hints);
    logger.info('✅ ZXing阅读器初始化完成');
    return true;
  }, []);

  // 启动相机
  const startCamera = useCallback(async () => {
    logger.info('📹 启动相机...');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('设备不支持相机功能');
      }

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      logger.info('请求相机权限...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // 等待视频元数据加载
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('视频元素未找到'));
            return;
          }

          videoRef.current.onloadedmetadata = () => {
            logger.info('📹 视频元数据加载完成');
            resolve();
          };

          videoRef.current.onerror = () => {
            reject(new Error('视频加载错误'));
          };
        });

        // 播放视频
        await videoRef.current.play();
        logger.info('✅ 视频播放成功');

        setCameraActive(true);
        return true;
      }

      throw new Error('视频元素未找到');
    } catch (err) {
      logger.error('❌ 相机启动失败:', err);
      setError(`相机启动失败: ${err}`);
      return false;
    }
  }, []);

  // 手动解码帧 - 核心解码逻辑，只解码中心扫描框内的区域
  const decodeFrame = useCallback(async (): Promise<Result | null> => {
    if (!videoRef.current || !canvasRef.current || !readerRef.current || !cameraActive) {
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context) {
        logger.warn('无法获取Canvas上下文');
        return null;
      }

      // 检查视频是否就绪
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        return null;
      }

      // 设置扫描框尺寸（与UI扫描框保持一致）
      const scanBoxSize = getScanBoxSize();
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // 计算视频中心扫描框的坐标
      const centerX = videoWidth / 2;
      const centerY = videoHeight / 2;
      const scanX = centerX - scanBoxSize / 2;
      const scanY = centerY - scanBoxSize / 2;

      // 设置canvas为扫描框尺寸
      canvas.width = scanBoxSize;
      canvas.height = scanBoxSize;

      // 只绘制视频中心扫描框内的区域到canvas
      context.drawImage(
        video,
        scanX, scanY, scanBoxSize, scanBoxSize,  // 源区域：视频中心扫描框
        0, 0, scanBoxSize, scanBoxSize          // 目标区域：整个canvas
      );

      // 使用ZXing解码扫描框内的区域
      try {
        // 将canvas转换为图像数据URL进行解码
        const imageDataUrl = canvas.toDataURL();
        // 使用正确的API：decodeFromImageUrl() 而不是 decodeFromImage()
        const result = await readerRef.current.decodeFromImageUrl(imageDataUrl);

        if (result) {
          logger.info('🎉 解码成功:', result.getText());
          return result;
        }
      } catch (decodeErr) {
        // 没有找到二维码是正常情况，不记录为错误
      }
    } catch (err) {
      // 这是正常情况，当前帧没有找到二维码
      // 不记录为错误，避免日志过多
    }

    return null;
  }, [cameraActive, getScanBoxSize]);

  // 开始扫描循环
  const startScanningLoop = useCallback(() => {
    logger.info('🔄 开始扫描循环...');

    let currentScanCount = 0;

    scanIntervalRef.current = setInterval(() => {
      currentScanCount++;
      setScanCount(currentScanCount);

      if (isDevelopment && debugMode && currentScanCount % 60 === 0) {
        logger.info(`📊 已扫描 ${currentScanCount} 帧`);
      }

      decodeFrame().then(result => {
        if (result) {
          handleScanSuccess(result.getText());
        }
      });
    }, 50); // 20fps扫描频率

    logger.info('✅ 扫描循环已启动');
  }, [decodeFrame, debugMode]);

  // 处理扫描成功
  const handleScanSuccess = useCallback(async (decodedText: string) => {
    logger.info('✅ 扫描成功回调:', decodedText);

    // 立即停止扫描
    stopScanning();

    // 触发反馈
    triggerVibration();
    playSuccessSound();

    setIsLoading(true);
    setScannedQR(decodedText);
    setError('');

    try {
      // 获取位置并处理结果
      const location = await getUserLocationAsync();
      await processQRCode(decodedText, location);
    } catch (err: any) {
      logger.error('处理扫描结果失败:', err);
      setError(`处理失败: ${err.message || err}`);

      // 3秒后重新开始扫描
      setTimeout(() => {
        setError('');
        startScanning();
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [triggerVibration, playSuccessSound, getUserLocationAsync]);

  // 处理二维码结果
  const processQRCode = useCallback(async (decodedText: string, location: {lat: number, lng: number}) => {
    try {
      const result = await qrTreasureService.scanQRCode(
        decodedText,
        location.lat,
        location.lng
      );

      logger.info('🎯 API调用成功:', result);
      logger.info('🎯 结果状态:', result.status);
      logger.info('🎯 是否有宝藏:', !!result.treasure);
      logger.info('🎯 消息:', result.message);
      setScanResult(result);
      setMode('result');

      if (onSuccess) {
        onSuccess(decodedText);
      }
    } catch (err: any) {
      logger.error('API调用失败:', err);
      throw new Error(err.message || '服务器错误');
    }
  }, [onSuccess]);

  // 停止扫描
  const stopScanning = useCallback(() => {
    logger.info('🛑 停止扫描...');

    // 停止扫描循环
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // 停止相机流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 重置ZXing
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (err) {
        logger.warn('重置ZXing失败:', err);
      }
    }

    setCameraActive(false);
    setScanCount(0);
    logger.info('✅ 扫描已停止');
  }, []);

  // 启动完整扫描流程
  const startScanning = useCallback(async () => {
    logger.info('🚀 启动扫描流程...');
    setIsLoading(true);
    setError('');

    try {
      // 1. 初始化ZXing
      if (!initializeReader()) {
        throw new Error('ZXing初始化失败');
      }

      // 2. 启动相机
      if (!await startCamera()) {
        throw new Error('相机启动失败');
      }

      // 3. 等待一下确保相机稳定
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 4. 开始扫描循环
      startScanningLoop();

      setIsLoading(false);
      logger.info('✅ 扫描流程启动完成');
    } catch (err: any) {
      logger.error('❌ 扫描流程启动失败:', err);
      setError(`启动失败: ${err.message || err}`);
      setIsLoading(false);
    }
  }, [initializeReader, startCamera, startScanningLoop]);

  // 文件扫描处理
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !readerRef.current) return;

    logger.info('📁 开始文件扫描:', file.name);
    setIsLoading(true);
    setError('');

    try {
      // 暂停相机扫描
      const wasCameraActive = cameraActive;
      if (wasCameraActive) {
        stopScanning();
      }

      // 使用ZXing扫描文件
      const result = await readerRef.current.decodeFromImageUrl(URL.createObjectURL(file));

      if (result) {
        logger.info('📁 文件扫描成功:', result.getText());
        handleScanSuccess(result.getText());
      } else {
        throw new Error('无法识别图片中的二维码');
      }
    } catch (err: any) {
      logger.error('❌ 文件扫描失败:', err);
      setError(`文件扫描失败: ${err.message || err}`);

      // 3秒后重新启动相机扫描
      setTimeout(() => {
        setError('');
        startScanning();
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [cameraActive, readerRef, handleScanSuccess, stopScanning, startScanning]);

  // 重新扫描
  const handleRescan = useCallback(() => {
    setScanResult(null);
    setScannedQR('');
    setError('');
    setMode('scanning');
    startScanning();
  }, [startScanning]);

  // 藏宝相关
  const handleHideClick = useCallback(() => {
    setMode('hiding');
  }, []);

  const handleHideSuccess = useCallback(() => {
    if (onSuccess) {
      onSuccess('藏宝成功');
    }
    // 设置藏宝成功状态，然后显示结果
    setScanResult({
      success: true,
      status: 'empty',
      message: '藏宝成功！',
      treasure: null,
      treasureHidden: true // 添加标记表示藏宝成功
    });
    setMode('result');
  }, [onSuccess]);

  // 组件生命周期
  useEffect(() => {
    if (isOpen) {
      logger.info('=== 打开ZXing扫描器 ===');
      // 获取位置（异步，不阻塞）
      getUserLocationAsync();
      startScanning();
    }

    return () => {
      logger.info('=== 关闭ZXing扫描器 ===');
      stopScanning();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // 只依赖isOpen，避免依赖循环

  const handleClose = useCallback(() => {
    stopScanning();
    setScanResult(null);
    setScannedQR('');
    setError('');
    setMode('scanning');
    onClose();
  }, [stopScanning, onClose]);

  if (!isOpen) return null;

  const scanBoxSize = getScanBoxSize();

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

    // 扫描界面
    mode === 'scanning' && React.createElement('div', {
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }
    },
      // 扫描框遮罩
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none'
        }
      },
        // 顶部遮罩 - 使用固定宽度的正方形遮罩
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: scanBoxSize,
            height: '50vh',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.3))',
            transform: `translate(-50%, -${scanBoxSize/2 + 25}vh)`,
            pointerEvents: 'none'
          }
        }),

        // 底部遮罩 - 使用固定宽度的正方形遮罩
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: scanBoxSize,
            height: '50vh',
            background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.3))',
            transform: `translate(-50%, ${scanBoxSize/2}px)`,
            pointerEvents: 'none'
          }
        }),

        // 左侧遮罩 - 创建对称的矩形遮罩
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: 0,
            width: 'calc(50% - ' + (scanBoxSize/2) + 'px)',
            height: scanBoxSize,
            background: 'linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.3))',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }
        }),

        // 右侧遮罩 - 创建对称的矩形遮罩
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            right: 0,
            width: 'calc(50% - ' + (scanBoxSize/2) + 'px)',
            height: scanBoxSize,
            background: 'linear-gradient(to left, rgba(0,0,0,0.9), rgba(0,0,0,0.3))',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }
        }),

        // 扫描框边角和扫描线
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: scanBoxSize,
            height: scanBoxSize,
            pointerEvents: 'none'
          }
        },
          // 扫描框边框
          React.createElement('div', {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: '2px solid rgba(0, 255, 136, 0.8)',
              borderRadius: '8px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)'
            }
          }),

          // 四个角
          React.createElement('div', {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: scanBoxSize * 0.15,
              height: scanBoxSize * 0.15,
              borderTop: '3px solid #60a5fa',
              borderLeft: '3px solid #60a5fa',
              borderTopLeftRadius: '8px'
            }
          }),
          React.createElement('div', {
            style: {
              position: 'absolute',
              top: 0,
              right: 0,
              width: scanBoxSize * 0.15,
              height: scanBoxSize * 0.15,
              borderTop: '3px solid #60a5fa',
              borderRight: '3px solid #60a5fa',
              borderTopRightRadius: '8px'
            }
          }),
          React.createElement('div', {
            style: {
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: scanBoxSize * 0.15,
              height: scanBoxSize * 0.15,
              borderBottom: '3px solid #60a5fa',
              borderLeft: '3px solid #60a5fa',
              borderBottomLeftRadius: '8px'
            }
          }),
          React.createElement('div', {
            style: {
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: scanBoxSize * 0.15,
              height: scanBoxSize * 0.15,
              borderBottom: '3px solid #60a5fa',
              borderRight: '3px solid #60a5fa',
              borderBottomRightRadius: '8px'
            }
          }),

          // 扫描线动画
          React.createElement('div', {
            style: {
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: '2px',
              background: 'linear-gradient(to right, transparent, #60a5fa, transparent)',
              animation: 'scan 2s infinite ease-in-out'
            }
          })
        )
      ),

      // 顶部导航栏
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent)',
          paddingBottom: '32px'
        }
      },
        React.createElement('div', { style: { width: '40px', height: '40px' } }),
        React.createElement('h1', {
          style: {
            color: 'white',
            fontWeight: 500,
            fontSize: '18px',
            margin: 0,
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }
        }, '扫一扫'),

        React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: '12px' }
        },
          // 开发环境调试按钮 - 生产环境隐藏
          isDevelopment && React.createElement('button', {
            onClick: () => setDebugMode(!debugMode),
            style: {
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: debugMode ? 'rgba(59, 130, 246, 0.6)' : 'rgba(0, 0, 0, 0.4)',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold',
              opacity: 0.8
            }
          }, 'D'),

          // 移除了右上角的藏宝按钮，改为扫码后根据结果决定是否需要藏宝

          React.createElement('button', {
            onClick: handleClose,
            style: {
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '50%',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.2s ease'
            }
          },
            React.createElement('svg', {
              style: { width: '24px', height: '24px' },
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
        )
      ),

      // 状态信息（仅在开发环境的调试模式下显示）
      isDevelopment && debugMode && React.createElement('div', {
        style: {
          position: 'absolute',
          top: '80px',
          left: '16px',
          right: '16px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: '#10b981',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }
      },
        React.createElement('div', { style: { marginBottom: '4px' } }, `📹 相机: ${cameraActive ? '✅ 就绪' : '❌ 未就绪'}`),
        React.createElement('div', { style: { marginBottom: '4px' } }, `🔄 扫描帧数: ${scanCount}`),
        React.createElement('div', { style: { marginBottom: '4px' } }, `📊 状态: ${isLoading ? '加载中' : cameraActive ? '扫描中' : '未启动'}`)
      ),

      // 提示文字
      React.createElement('div', {
        style: {
          position: 'absolute',
          bottom: '120px',
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

      // 底部功能区
      React.createElement('div', {
        style: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.4), transparent)',
          paddingBottom: '100px',
          paddingTop: '60px'
        }
      },
        React.createElement('div', {
          style: {
            display: 'flex',
            justifyContent: 'center',
            gap: '48px'
          }
        },
          // 相册按钮
          React.createElement('input', {
            type: 'file',
            accept: 'image/*',
            onChange: handleFileUpload,
            style: { display: 'none' },
            id: 'file-input'
          }),
          React.createElement('label', {
            htmlFor: 'file-input',
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }
          },
            React.createElement('div', {
              style: {
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
                backdropFilter: 'blur(10px)'
              }
            },
              React.createElement('svg', {
                style: { width: '24px', height: '24px' },
                fill: 'none',
                stroke: 'currentColor',
                viewBox: '0 0 24 24'
              },
                React.createElement('path', {
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  strokeWidth: 2,
                  d: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z'
                }),
                React.createElement('path', {
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  strokeWidth: 2,
                  d: 'M15 13a3 3 0 11-6 0 3 3 0 016 0z'
                })
              )
            ),
            React.createElement('span', {
              style: { textShadow: '0 2px 4px rgba(0,0,0,0.5)' }
            }, '相册')
          )
        )
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
            display: 'inline-block',
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: 'white',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '16px'
          }
        }),
        React.createElement('p', { style: { fontSize: '18px' } },
          !cameraActive ? '正在启动相机...' : '正在处理...'
        )
      ),

      // 错误提示
      error && React.createElement('div', {
        style: {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(239, 68, 68, 0.9)',
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
            cursor: 'pointer',
            marginRight: '8px'
          }
        }, '重试'),
        React.createElement('button', {
          onClick: () => setError(''),
          style: {
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }
        }, '关闭')
      )
    ),

    // 结果界面
    mode === 'result' && scanResult && userLocation && React.createElement('div', {
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #e5e7eb'
        }
      },
        React.createElement('button', {
          onClick: handleClose,
          style: {
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#374151',
            backgroundColor: '#f3f4f6',
            border: '2px solid #e5e7eb',
            borderRadius: '50%',
            cursor: 'pointer'
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
              strokeWidth: 2.5,
              d: 'M6 18L18 6M6 6l12 12'
            })
          )
        ),
        React.createElement('h1', {
          style: { color: '#111827', fontWeight: 600, fontSize: '18px', margin: 0 }
        }, '扫描结果'),
        React.createElement('div', { style: { width: '40px', height: '40px' } })
      ),

      React.createElement('div', {
        style: { flex: 1, padding: '16px', overflowY: 'auto' }
      },
        scanResult.status === 'found' && React.createElement(TreasureFoundCard, {
          treasure: scanResult.treasure,
          userLocation: userLocation,
          onClaim: () => {
            if (onSuccess) {
              onSuccess('宝藏获取成功');
            }
          },
          onClose: handleClose,
          onViewBackpack: onViewBackpack
        }),
        scanResult.status === 'nearby' && React.createElement(TreasureNearbyCard, {
          distance: scanResult.distance || 0,
          direction: scanResult.direction || '',
          hint: scanResult.hint,
          onRefresh: handleRescan
        }),
        scanResult.status === 'empty' && React.createElement(NoTreasureCard, {
          onHideClick: handleHideClick,
          onRescan: handleRescan,
          onViewBackpack: onViewBackpack,
          treasureHidden: scanResult.treasureHidden || false
        })
      )
    ),

    // 藏宝界面
    mode === 'hiding' && userLocation && React.createElement('div', {
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #e5e7eb'
        }
      },
        React.createElement('button', {
          onClick: handleRescan,
          style: {
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#374151',
            backgroundColor: '#f3f4f6',
            border: '2px solid #e5e7eb',
            borderRadius: '50%',
            cursor: 'pointer'
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
              strokeWidth: 2.5,
              d: 'M15 19l-7-7 7-7'
            })
          )
        ),
        React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: '8px' }
        },
          React.createElement('svg', {
            style: { width: '20px', height: '20px', color: '#a855f7' },
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24'
          },
            React.createElement('path', {
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeWidth: 2,
              d: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
            })
          ),
          React.createElement('h1', {
            style: { color: '#111827', fontWeight: 600, fontSize: '18px', margin: 0 }
          }, '藏宝')
        ),
        React.createElement('div', { style: { width: '40px', height: '40px' } })
      ),

      React.createElement('div', {
        style: { flex: 1, padding: '16px', overflowY: 'auto' }
      },
        React.createElement(HideTreasureForm, {
          qrContent: scannedQR,
          userLocation: userLocation,
          onSuccess: handleHideSuccess,
          onCancel: handleRescan
        })
      )
    ),

    // CSS动画
    React.createElement('style', {
      dangerouslySetInnerHTML: {
        __html: `
          @keyframes scan {
            0% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(${scanBoxSize - 2}px); opacity: 0.8; }
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

export default ZXingScannerModern;