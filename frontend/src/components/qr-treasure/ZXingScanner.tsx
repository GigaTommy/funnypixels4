import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader, Result, DecodeHintType, BarcodeFormat } from '@zxing/library';
import qrTreasureService, { ScanResult } from '../../services/qrTreasureService';
import HideTreasureForm from './HideTreasureForm';
import TreasureFoundCard from './TreasureFoundCard';
import TreasureNearbyCard from './TreasureNearbyCard';
import NoTreasureCard from './NoTreasureCard';
import { logger } from '../../utils/logger';

interface ZXingScannerProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'scan' | 'hide';
  onSuccess?: () => void;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  kind: 'video' | 'audio';
}

const ZXingScanner: React.FC<ZXingScannerProps> = ({
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
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanQuality, setScanQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 响应式扫描框尺寸
  const getScanBoxSize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);

    // 更精确的响应式设计
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
      readerRef.current.reset();
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

  // 获取可用摄像头
  const getAvailableCameras = useCallback(async (): Promise<CameraDevice[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
          kind: device.kind as 'video'
        }));
    } catch (err) {
      logger.error('获取摄像头列表失败:', err);
      return [];
    }
  }, []);

  // 启动相机
  const startCamera = useCallback(async (cameraId?: string) => {
    try {
      // 停止现有流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          deviceId: cameraId ? { exact: cameraId } : { ideal: 'environment' },
          width: {
            ideal: scanQuality === 'high' ? 1920 : scanQuality === 'medium' ? 1280 : 640,
            min: 640
          },
          height: {
            ideal: scanQuality === 'high' ? 1080 : scanQuality === 'medium' ? 720 : 480,
            min: 480
          },
          facingMode: 'environment',
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsCameraActive(true);

      // 更新活动摄像头ID
      if (stream.getVideoTracks()[0]) {
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        if (settings.deviceId) {
          setActiveCameraId(settings.deviceId);
        }
      }

      return true;
    } catch (err: any) {
      logger.error('启动相机失败:', err);
      setError(`无法启动相机: ${err.message || '未知错误'}`);
      return false;
    }
  }, [scanQuality]);

  // 切换手电筒
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && 'torch' in videoTrack.getCapabilities()) {
        const capabilities = videoTrack.getCapabilities() as any;
        if (capabilities.torch) {
          await videoTrack.applyConstraints({
            advanced: [{ torch: !torchEnabled }]
          } as any);
          setTorchEnabled(!torchEnabled);
        }
      }
    } catch (err) {
      logger.warn('切换手电筒失败:', err);
    }
  }, [torchEnabled]);

  // 切换摄像头
  const switchCamera = useCallback(async () => {
    const cameras = await getAvailableCameras();
    if (cameras.length < 2) return;

    const currentIndex = cameras.findIndex(cam => cam.deviceId === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    await startCamera(nextCamera.deviceId);
  }, [activeCameraId, getAvailableCameras, startCamera]);

  // 扫描帧
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !readerRef.current || !isCameraActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    // 设置canvas尺寸
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 绘制视频帧到canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // 创建图像数据
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // 使用ZXing解码 - 暂时禁用以避免API问题
      // const result = readerRef.current.decodeFromImage(imageData);
      // if (result) {
      //   handleScanSuccess(result.getText());
      //   return;
      // }
    } catch (err) {
      // 没有找到二维码是正常的，继续扫描
    }

    // 继续扫描下一帧
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [isCameraActive]);

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
  }, [isLoading, triggerVibration, playSuccessSound]);

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

  // 停止扫描
  const stopScanning = useCallback(() => {
    // 停止动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 停止相机流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 重置ZXing阅读器
    if (readerRef.current) {
      readerRef.current.reset();
    }

    setIsCameraActive(false);
    setTorchEnabled(false);
  }, []);

  // 启动扫描
  const startScanning = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      // 初始化ZXing阅读器
      initializeReader();

      // 获取摄像头列表
      const cameras = await getAvailableCameras();
      setAvailableCameras(cameras);

      // 启动相机
      const cameraStarted = await startCamera();
      if (!cameraStarted) {
        throw new Error('无法启动相机');
      }

      // 开始扫描帧
      setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }, 1000); // 延迟开始扫描，确保相机稳定

    } catch (err: any) {
      logger.error('启动扫描失败:', err);
      setError(err.message || '启动扫描失败');
    } finally {
      setIsLoading(false);
    }
  }, [initializeReader, getAvailableCameras, startCamera, scanFrame]);

  // 文件扫描
  const handleFileScan = useCallback(async (file: File) => {
    setIsLoading(true);
    setError('');

    try {
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
  }, [triggerVibration, playSuccessSound, handleScanSuccess]);

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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000000',
      zIndex: 100000
    }}>
      {/* 扫描界面 */}
      {mode === 'scanning' && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 视频元素（隐藏的canvas用于扫描） */}
          <video
            ref={videoRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            playsInline
            muted
          />

          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />

          {/* 扫描框覆盖层 */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none'
          }}>
            {/* 顶部遮罩 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.4))',
              transform: `translateY(-${scanBoxSize/2}px)`
            }} />

            {/* 底部遮罩 */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.4))',
              transform: `translateY(${scanBoxSize/2}px)`
            }} />

            {/* 左侧遮罩 */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              width: '50%',
              height: scanBoxSize,
              background: 'linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.4))',
              transform: `translate(-50%, -50%)`
            }} />

            {/* 右侧遮罩 */}
            <div style={{
              position: 'absolute',
              top: '50%',
              right: 0,
              width: '50%',
              height: scanBoxSize,
              background: 'linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0.4))',
              transform: `translate(50%, -50%)`
            }} />

            {/* 扫描框边角 */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: scanBoxSize,
              height: scanBoxSize
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: scanBoxSize * 0.15,
                height: scanBoxSize * 0.15,
                borderTop: '3px solid #60a5fa',
                borderLeft: '3px solid #60a5fa',
                borderTopLeftRadius: '8px'
              }} />
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: scanBoxSize * 0.15,
                height: scanBoxSize * 0.15,
                borderTop: '3px solid #60a5fa',
                borderRight: '3px solid #60a5fa',
                borderTopRightRadius: '8px'
              }} />
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: scanBoxSize * 0.15,
                height: scanBoxSize * 0.15,
                borderBottom: '3px solid #60a5fa',
                borderLeft: '3px solid #60a5fa',
                borderBottomLeftRadius: '8px'
              }} />
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: scanBoxSize * 0.15,
                height: scanBoxSize * 0.15,
                borderBottom: '3px solid #60a5fa',
                borderRight: '3px solid #60a5fa',
                borderBottomRightRadius: '8px'
              }} />

              {/* 扫描线动画 */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '10%',
                right: '10%',
                height: '2px',
                background: 'linear-gradient(to right, transparent, #60a5fa, transparent)',
                animation: 'scan 2s infinite ease-in-out'
              }} />
            </div>
          </div>

          {/* 顶部导航 */}
          <div style={{
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
          }}>
            <div style={{ width: '40px', height: '40px' }}></div>
            <h1 style={{ color: 'white', fontWeight: 500, fontSize: '18px', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>扫一扫</h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handleClose}
                style={{
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
                }}
              >
                <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <button
                onClick={handleHideClick}
                style={{
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
                }}
              >
                <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* 控制按钮 */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            pointerEvents: 'auto'
          }}>
            {availableCameras.length > 1 && (
              <button
                onClick={switchCamera}
                style={{
                  position: 'absolute',
                  right: `-${scanBoxSize/2 + 40}px`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {isCameraActive && (
              <button
                onClick={toggleTorch}
                style={{
                  position: 'absolute',
                  left: `-${scanBoxSize/2 + 40}px`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: torchEnabled ? 'rgba(255, 193, 7, 0.8)' : 'rgba(0, 0, 0, 0.6)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </button>
            )}
          </div>

          {/* 提示文字 */}
          <div style={{
            position: 'absolute',
            bottom: '120px',
            left: 0,
            right: 0,
            textAlign: 'center',
            color: 'white',
            pointerEvents: 'none'
          }}>
            <p style={{ fontSize: `${scanBoxSize * 0.05}px`, marginBottom: '8px' }}>将二维码放入框内，即可自动扫描</p>
            <p style={{ fontSize: `${scanBoxSize * 0.04}px`, color: 'rgba(255, 255, 255, 0.7)' }}>支持二维码和条形码</p>
          </div>

          {/* 底部功能区 */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.4), transparent)',
            paddingBottom: '100px',
            paddingTop: '60px',
            pointerEvents: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '48px',
              color: 'white',
              fontSize: '14px'
            }}>
              {/* 相册按钮 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: 'white',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: '8px'
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>相册</span>
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
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
            }}>
              <p style={{ marginBottom: '12px' }}>{error}</p>
              <button
                onClick={() => setError('')}
                style={{
                  backgroundColor: 'white',
                  color: '#ef4444',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                关闭
              </button>
            </div>
          )}

          {/* 加载状态 */}
          {isLoading && !error && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'white',
              zIndex: 20
            }}>
              <div style={{
                display: 'inline-block',
                width: '48px',
                height: '48px',
                border: '4px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: '16px'
              }} />
              <p style={{ fontSize: '18px' }}>
                {!isCameraActive ? '正在启动相机...' : '正在处理...'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 结果界面 - 保持原有逻辑 */}
      {mode === 'result' && scanResult && userLocation && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white'
        }}>
          {/* 顶部导航栏 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: 'white'
          }}>
            <button
              onClick={handleClose}
              style={{
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
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h1 style={{ color: '#111827', fontWeight: 600, fontSize: '18px', margin: 0 }}>扫描结果</h1>

            <div style={{ width: '40px', height: '40px' }}></div>
          </div>

          {/* 结果内容 */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            {scanResult.status === 'found' && (
              <TreasureFoundCard
                treasure={scanResult.treasure}
                userLocation={userLocation}
                onClaim={onSuccess}
                onClose={handleClose}
              />
            )}
            {scanResult.status === 'nearby' && (
              <TreasureNearbyCard
                distance={scanResult.distance || 0}
                direction={scanResult.direction || ''}
                hint={scanResult.hint}
                onRefresh={handleRescan}
              />
            )}
            {scanResult.status === 'empty' && (
              <NoTreasureCard
                onHideClick={handleHideClick}
                onRescan={handleRescan}
              />
            )}
          </div>
        </div>
      )}

      {/* 藏宝界面 - 保持原有逻辑 */}
      {mode === 'hiding' && userLocation && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white'
        }}>
          {/* 顶部导航栏 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: 'white'
          }}>
            <button
              onClick={handleRescan}
              style={{
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
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg style={{ width: '20px', height: '20px', color: '#a855f7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h1 style={{ color: '#111827', fontWeight: 600, fontSize: '18px', margin: 0 }}>藏宝</h1>
            </div>

            <div style={{ width: '40px', height: '40px' }}></div>
          </div>

          {/* 藏宝内容 */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            <HideTreasureForm
              qrContent={scannedQR}
              userLocation={userLocation}
              onSuccess={handleHideSuccess}
              onCancel={handleRescan}
            />
          </div>
        </div>
      )}

      {/* CSS动画 */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(${scanBoxSize - 2}px); opacity: 0.8; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ZXingScanner;