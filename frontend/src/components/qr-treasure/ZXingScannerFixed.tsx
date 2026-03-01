import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader, Result, DecodeHintType, BarcodeFormat } from '@zxing/library';
import qrTreasureService, { ScanResult } from '../../services/qrTreasureService';
import HideTreasureForm from './HideTreasureForm';
import TreasureFoundCard from './TreasureFoundCard';
import TreasureNearbyCard from './TreasureNearbyCard';
import NoTreasureCard from './NoTreasureCard';
import { logger } from '../../utils/logger';

interface ZXingScannerFixedProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'scan' | 'hide';
  onSuccess?: () => void;
}

const ZXingScannerFixed: React.FC<ZXingScannerFixedProps> = ({
  isOpen,
  onClose,
  initialMode = 'scan',
  onSuccess
}) => {
  const [mode, setMode] = useState<'scanning' | 'result' | 'hiding'>('scanning');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scannedQR, setScannedQR] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [retryKey, setRetryKey] = useState(0);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanQuality, setScanQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [isScanning, setIsScanning] = useState(false);

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

  // 启动扫描
  const startScanning = useCallback(async () => {
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
          if (result) {
            handleScanSuccess(result.getText());
          }
        }
      );

      setIsScanning(true);

    } catch (err: any) {
      logger.error('启动扫描失败:', err);
      setError(`无法启动相机: ${err.message || '未知错误'}`);
      setIsScanning(false);
    } finally {
      setIsLoading(false);
    }
  }, [initializeReader, scanQuality]);

  // 停止扫描
  const stopScanning = useCallback(() => {
    if (readerRef.current && isScanning) {
      try {
        readerRef.current.reset();
      } catch (err) {
        logger.error('停止扫描失败:', err);
      }
    }
    setIsScanning(false);
    setTorchEnabled(false);
  }, [isScanning]);

  // 处理扫描成功
  const handleScanSuccess = useCallback(async (decodedText: string) => {
    if (isLoading) return;

    setIsLoading(true);
    setScannedQR(decodedText);

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
      setError(err.message || '扫描处理失败');
      setIsLoading(false);
      // 可以选择重新开始扫描
      setTimeout(() => {
        setError('');
        startScanning();
      }, 2000);
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
    } finally {
      setIsLoading(false);
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

  // 文件扫描
  const handleFileScan = useCallback(async (file: File) => {
    setIsLoading(true);
    setError('');

    try {
      if (!readerRef.current) {
        initializeReader();
      }

      // 使用ZXing扫描文件
      const result = await readerRef.current?.decodeFromImageUrl(URL.createObjectURL(file));

      if (result) {
        triggerVibration();
        playSuccessSound();
        await handleScanSuccess(result.getText());
      } else {
        throw new Error('无法识别图片中的二维码');
      }
    } catch (err: any) {
      setError('无法识别图片中的二维码，请选择包含二维码的清晰图片');
    } finally {
      setIsLoading(false);
    }
  }, [initializeReader, triggerVibration, playSuccessSound, handleScanSuccess]);

  // 处理文件上传
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileScan(file);
    }
  }, [handleFileScan]);

  // 重新扫描
  const handleRescan = useCallback(() => {
    setScanResult(null);
    setScannedQR('');
    setError('');
    setIsLoading(false);
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

  // 启动扫描
  useEffect(() => {
    if (isOpen && mode === 'scanning' && !isLoading) {
      startScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen, mode, isLoading, retryKey, startScanning, stopScanning]);

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

          React.createElement('button', {
            onClick: handleHideClick,
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
                d: 'M12 4v16m8-8H4'
              })
            )
          )
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
        }, '将二维码放入框内，即可自动扫描'),
        React.createElement('p', {
          style: { fontSize: `${scanBoxSize * 0.04}px`, color: 'rgba(255, 255, 255, 0.7)' }
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
              padding: '8px'
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
          maxWidth: '80%',
          zIndex: 20
        }
      },
        React.createElement('p', { style: { marginBottom: '12px' } }, error),
        React.createElement('button', {
          onClick: () => setError(''),
          style: {
            backgroundColor: 'white',
            color: '#ef4444',
            border: 'none',
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
          !isScanning ? '正在启动相机...' : '正在处理...'
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
          onClose: handleClose
        }),
        scanResult.status === 'nearby' && React.createElement(TreasureNearbyCard, {
          distance: scanResult.distance || 0,
          direction: scanResult.direction || '',
          hint: scanResult.hint,
          onRefresh: handleRescan
        }),
        scanResult.status === 'empty' && React.createElement(NoTreasureCard, {
          onHideClick: handleHideClick,
          onRescan: handleRescan
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

export default ZXingScannerFixed;