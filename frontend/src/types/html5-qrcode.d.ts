// Type declarations for html5-qrcode library
declare class Html5Qrcode {
  constructor(elementId: string);

  start(
    cameraIdOrConfig: string | { facingMode?: string },
    config?: any,
    qrCodeSuccessCallback: (decodedText: string, decodedResult: any) => void,
    qrCodeErrorCallback?: (errorMessage: string) => void
  ): Promise<void>;

  stop(): Promise<void>;

  scanFile(
    file: File,
    successCallback: (decodedText: string, decodedResult: any) => void
  ): Promise<void>;

  pause(): void;

  resume(): void;

  isScanning(): boolean;

  isVideoPaused(): boolean;

  clear(): void;

  static getCameras(): Promise<Array<{ id: string; label: string }>>;
}

declare class Html5QrcodeScanner {
  constructor(
    elementId: string,
    config?: any,
    verbose?: boolean
  );

  render(onSuccess: (decodedText: string, decodedResult: any) => void);

  clear(): void;
}

export { Html5Qrcode, Html5QrcodeScanner };