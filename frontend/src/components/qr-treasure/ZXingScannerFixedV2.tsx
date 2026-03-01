import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader, Result, DecodeHintType, BarcodeFormat } from '@zxing/library';
import qrTreasureService, { ScanResult } from '../../services/qrTreasureService';
import HideTreasureForm from './HideTreasureForm';
import TreasureFoundCard from './TreasureFoundCard';
import TreasureNearbyCard from './TreasureNearbyCard';
import NoTreasureCard from './NoTreasureCard';
import { logger } from '../../utils/logger';

interface ZXingScannerFixedV2Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'scan' | 'hide';
  onSuccess?: () => void;
  onViewBackpack?: () => void;
}

const ZXingScannerFixedV2: React.FC<ZXingScannerFixedV2Props> = ({
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
  const [retryKey, setRetryKey] = useState(0);
  const [scanQuality, setScanQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [isScanning, setIsScanning] = useState(false);
  const [isFileScanning, setIsFileScanning] = useState(false); // 新增：文件扫描状态

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 响应式扫描框尺寸
  const getScanBoxSize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const maxDimension = Math.max(width, height);

    if (maxDimension < 400) return 180;
    if (maxDimension < 600) return 220;
    if (maxDimension < 800) return 280;
    if (maxDimension < 1200) return 320;
    return 380;
  }, []);

  // 震动反馈
  const triggerVibration = useCallback((pattern: number | number[] = 200) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
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

  // 重置扫描状态 - 新增辅助函数
  const resetScanState = useCallback(() => {
    setIsLoading(false);
    setError('');
    setIsFileScanning(false);
  }, []);

  // 初始化ZXing阅读器
  const initializeReader = useCallback(() => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        // 忽略重置错误
      }
    }

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
  }, []);

  // 启动相机扫描
  const startCameraScanning = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      // 初始化ZXing阅读器
      initializeReader();

      if (!readerRef.current || !videoRef.current) {
        throw new Error('ZXing阅读器或视频元素未初始化');
      }

      // 配置相机约束
      const constraints = {
        video: {
          facingMode: 'environment',
          width: {
            ideal: scanQuality === 'high' ? 1920 : scanQuality === 'medium' ? 1280 : 640,
            min: 640
          },
          height: {
            ideal: scanQuality === 'high' ? 1080 : scanQuality === 'medium' ? 720 : 480,
            min: 480
          },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      };

      // 启动扫描
      await readerRef.current.decodeFromVideoDevice(
        undefined, // 让ZXing自动选择设备
        videoRef.current,
        (result: Result | null) => {
          if (result && !isFileScanning) { // 防止文件扫描时触发相机扫描回调
            handleScanSuccess(result.getText());
          }
        }
      );

      setIsScanning(true);

    } catch (err: any) {
      logger.error('启动相机扫描失败:', err);
      setError(`无法启动相机: ${err.message || '未知错误'}`);
      setIsScanning(false);
    } finally {
      setIsLoading(false);
    }
  }, [initializeReader, scanQuality, isFileScanning]);

  // 文件扫描 - 重写此方法
  const handleFileScan = useCallback(async (file: File) => {
    try {
      setIsLoading(true);
      setError('');
      setIsFileScanning(true); // 标记为文件扫描模式

      // 暂停相机扫描
      if (readerRef.current && isScanning) {
        try {
          readerRef.current.reset();
        } catch (err) {
          logger.error('暂停相机扫描失败:', err);
        }
        setIsScanning(false);
      }

      // 创建新的阅读器实例用于文件扫描
      const fileReader = new BrowserMultiFormatReader();

      logger.info('开始扫描文件:', file.name);

      // 使用ZXing扫描文件
      const result = await fileReader.decodeFromImageUrl(URL.createObjectURL(file));
      logger.info('文件扫描成功:', result?.getText());

      if (result) {
        triggerVibration();
        playSuccessSound();

        // 处理扫描结果
        await handleScanSuccess(result.getText());
      } else {
        throw new Error('无法识别图片中的二维码');
      }

    } catch (err: any) {
      logger.error('文件扫描失败:', err);

      // 设置具体错误信息
      let errorMessage = '无法识别图片中的二维码';
      if (err.message && err.message.includes('No code found')) {
        errorMessage = '图片中未找到二维码，请选择包含清晰二维码的图片';
      } else if (err.message && err.message.includes('No MultiFormat Readers')) {
        errorMessage = '图片格式不支持，请选择JPG、PNG等常见格式';
      } else if (err.message) {
        errorMessage = `扫描失败: ${err.message}`;
      }

      setError(errorMessage);

      // 3秒后清除错误信息，重新启动相机扫描
      setTimeout(() => {
        resetScanState();
        // 重新启动相机扫描
        if (isOpen && mode === 'scanning') {
          startCameraScanning();
        }
      }, 3000);

    } finally {
      setIsLoading(false);
      setIsFileScanning(false);
    }
  }, [triggerVibration, playSuccessSound, resetScanState, isOpen, mode, isScanning, startCameraScanning]);

  // 处理文件上传 - 简化
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      logger.info('用户选择文件:', file.name);
      handleFileScan(file);
    }
  }, [handleFileScan]);

  // 停止扫描
  const stopScanning = useCallback(() => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (err) {
        logger.error('停止扫描失败:', err);
      }
    }
    setIsScanning(false);
  }, []);

  // 处理扫描成功 - 修改状态管理
  const handleScanSuccess = useCallback(async (decodedText: string) => {
    if (isLoading) return;

    logger.info('扫描成功:', decodedText);

    setIsLoading(true);
    setScannedQR(decodedText);
    setError(''); // 清除任何之前的错误

    // 触发反馈
    triggerVibration([100, 50, 100]);
    playSuccessSound();

    try {
      // 停止扫描
      stopScanning();

      // 获取位置
      const location = await getUserLocationAsync();
      await processQRCode(decodedText, location);
    } catch (err: any) {
      logger.error('处理扫描结果失败:', err);
      setError(err.message || '扫描处理失败');

      // 处理失败后重置状态，重新开始扫描
      setTimeout(() => {
        resetScanState();
        startCameraScanning();
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, triggerVibration, playSuccessSound, stopScanning]);

  // 处理二维码结果
  const processQRCode = useCallback(async (decodedText: string, location: {lat: number, lng: number}) => {
    try {
      const result = await qrTreasureService.scanQRCode(
        decodedText,
        location.lat,
        location.lng
      );

      setScanResult(result);
      setMode('result');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      throw err;
    }
  }, [onSuccess]);

  // 获取用户位置（异步）
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
      return location;
    } catch (err) {
      logger.warn('位置获取失败，使用默认位置:', err);
      const defaultLocation = { lat: 39.9042, lng: 116.4074 };
      setUserLocation(defaultLocation);
      return defaultLocation;
    }
  }, [userLocation]);

  // 重新扫描
  const handleRescan = useCallback(() => {
    setScanResult(null);
    setScannedQR('');
    setError('');
    setIsLoading(false);
    setIsFileScanning(false);
    setIsScanning(false);
    setMode('scanning');
    setRetryKey(prev => prev + 1);
  }, []);

  // 藏宝相关
  const handleHideClick = useCallback(() => {
    setMode('hiding');
  }, []);

  const handleHideSuccess = useCallback(() => {
    if (onSuccess) {
      onSuccess();
    }
    alert('藏宝成功！');
    onClose();
  }, [onSuccess, onClose]);

  // 获取用户位置（初始化）
  useEffect(() => {
    if (isOpen && !userLocation) {
      getUserLocationAsync();
    }
  }, [isOpen, userLocation, getUserLocationAsync]);

  // 启动扫描 - 修改逻辑
  useEffect(() => {
    if (isOpen && mode === 'scanning' && !isLoading && !isFileScanning) {
      startCameraScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen, mode, isLoading, retryKey, isFileScanning, startCameraScanning, stopScanning]);

  // 清理
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const handleClose = useCallback(() => {
    stopScanning();
    setScanResult(null);
    setScannedQR('');
    setError('');
    setMode('scanning');
    setUserLocation(null);
    setIsFileScanning(false);
    setIsScanning(false);
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

      // 扫描框覆盖层
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
        // 顶部遮罩
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.4))',
            transform: `translateY(-${scanBoxSize/2}px)`
          }
        }),

        // 底部遮罩
        React.createElement('div', {
          style: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '50%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.4))',
            transform: `translateY(${scanBoxSize/2}px)`
          }
        }),

        // 左侧遮罩
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: 0,
            width: '50%',
            height: scanBoxSize,
            background: 'linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.4))',
            transform: `translate(-50%, -50%)`
          }
        }),

        // 右侧遮罩
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            right: 0,
            width: '50%',
            height: scanBoxSize,
            background: 'linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0.4))',
            transform: `translate(50%, -50%)`
          }
        }),

        // 扫描框边角
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: scanBoxSize,
            height: scanBoxSize
          }
        },
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

      // 顶部导航
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
          React.createElement('button', {
            onClick: handleClose,
            style: {
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '50%',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
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
                d: 'M6 18L18 6M6 6l12 12'
              })
            )
          ),

          // 移除了右上角的藏宝按钮，改为扫码后根据结果决定是否需要藏宝
        )
      ),

      // 提示文字
      React.createElement('div', {
        style: {
          position: 'absolute',
          bottom: '120px',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'white',
          pointerEvents: 'none'
        }
      },
        React.createElement('p', {
          style: { fontSize: `${scanBoxSize * 0.05}px`, marginBottom: '8px' }
        }, isFileScanning ? '正在识别图片中的二维码...' : '将二维码放入框内，即可自动扫描'),
        React.createElement('p', {
          style: { fontSize: `${scanBoxSize * 0.04}px`, color: 'rgba(255, 255, 255, 0.7)' }
        }, isFileScanning ? '请确保图片清晰，包含有效的二维码' : '支持二维码和条形码')
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
          paddingTop: '60px',
          pointerEvents: 'auto'
        }
      },
        React.createElement('div', {
          style: {
            display: 'flex',
            justifyContent: 'center',
            gap: '48px',
            color: 'white',
            fontSize: '14px'
          }
        },
          // 相册按钮
          React.createElement('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/*',
            onChange: handleFileUpload,
            style: { display: 'none' }
          }),
          React.createElement('button', {
            onClick: () => fileInputRef.current?.click(),
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: 'white',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              padding: '8px',
              opacity: isFileScanning ? 0.5 : 1, // 文件扫描时禁用按钮
              pointerEvents: isFileScanning ? 'none' : 'auto'
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
            }, isFileScanning ? '识别中...' : '相册')
          )
        )
      ),

      // 错误提示 - 改进显示
      error && React.createElement('div', {
        style: {
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          textAlign: 'center',
          maxWidth: '80%',
          zIndex: 20
        }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
          React.createElement('svg', {
            style: { width: '24px', height: '24px', marginRight: '8px' },
            fill: 'currentColor',
            viewBox: '0 0 20 20'
          },
            React.createElement('path', {
              fillRule: 'evenodd',
              d: 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
              clipRule: 'evenodd'
            })
          )
        ),
        React.createElement('p', { style: { marginBottom: '8px', fontWeight: '500' } }, error),
        React.createElement('p', {
          style: { fontSize: '12px', opacity: 0.8, marginBottom: '12px' }
        }, '3秒后自动重试...'),
        React.createElement('button', {
          onClick: () => {
            resetScanState();
            startCameraScanning();
          },
          style: {
            backgroundColor: 'white',
            color: '#ef4444',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            marginRight: '8px'
          }
        }, '立即重试'),
        React.createElement('button', {
          onClick: () => resetScanState(),
          style: {
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }
        }, '关闭')
      ),

      // 加载状态
      isLoading && !error && React.createElement('div', {
        style: {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'white',
          zIndex: 20
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
          isFileScanning ? '正在识别图片...' : !isScanning ? '正在启动相机...' : '正在处理...'
        )
      )
    ),

    // 结果界面 - 保持原有逻辑
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
      // 顶部导航栏
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white'
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
            cursor: 'pointer',
            transition: 'all 0.3s ease'
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

      // 结果内容
      React.createElement('div', {
        style: { flex: 1, padding: '16px', overflowY: 'auto' }
      },
        scanResult.status === 'found' && React.createElement(TreasureFoundCard, {
          treasure: scanResult.treasure,
          userLocation: userLocation,
          onClaim: onSuccess,
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
          treasureHidden: false
        })
      )
    ),

    // 藏宝界面 - 保持原有逻辑
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
      // 顶部导航栏
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white'
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
            cursor: 'pointer',
            transition: 'all 0.3s ease'
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

      // 藏宝内容
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

export default ZXingScannerFixedV2;