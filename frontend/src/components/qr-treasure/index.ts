// QR Treasure 组件导出

// 推荐使用的现代化扫描器
export { default as ZXingScannerModern } from './ZXingScannerModern';

// 其他扫描器实现
export { default as ZXingScanner } from './ZXingScanner';
export { default as ZXingScannerProfessional } from './ZXingScanner';

// 旧版本扫描器（不推荐，仅用于兼容性）
// export { default as QRScannerModal } from './QRScannerModal';

// 业务组件
export { default as HideTreasureForm } from './HideTreasureForm';
export { default as TreasureFoundCard } from './TreasureFoundCard';
export { default as TreasureNearbyCard } from './TreasureNearbyCard';
export { default as NoTreasureCard } from './NoTreasureCard';

// 推荐使用 ZXingScannerModern，它基于最新的 @zxing/library API
// 具有更好的性能、稳定性和日志系统
//
// 用法示例：
// import { ZXingScannerModern } from '@/components/qr-treasure';
//
// <ZXingScannerModern
//   isOpen={scannerOpen}
//   onClose={() => setScannerOpen(false)}
//   onSuccess={handleSuccess}
//   initialMode="scan"  // "scan" | "hide"
// />