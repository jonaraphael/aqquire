import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAnalyzeCapture,
  useFinalizeCaptureProcuring,
  useStartCaptureProcuring,
  useViewerContext,
} from '@/lib/localBackend';
import { useDebugMode } from '@/hooks/useDebugMode';

interface CaptureResult {
  displayName: string;
  heroImageUrl: string;
  capturedImageUrl?: string;
  category:
    | 'Handbags'
    | 'Timepieces'
    | 'Automobiles'
    | 'Jewelry'
    | 'Art'
    | 'Footwear'
    | 'Outerwear'
    | 'Home'
    | 'Tech'
    | 'Travel'
    | 'Experiences'
    | 'Other';
  priceEstimate: number;
  currency: string;
  supplierName?: string;
  supplierUrl?: string;
  uniqueFlag: boolean;
  confidence?: number;
  canonicalName: string;
  brandHints: string[];
  keyAttributes: string[];
  alternates: string[];
  debugPriceBreakdown?: {
    baseCost: number;
    shipping: number;
    serviceFee: number;
  };
}

const AQQUIRE_CAPTURE_EVENT = 'aqquire:capture';
const AQQUIRE_PROCUREMENT_COMPLETE_EVENT = 'aqquire:procurement-complete';
const CAMERA_SPARKLES = [
  { left: '14%', top: '18%', delay: '0.2s', duration: '4.6s' },
  { left: '82%', top: '24%', delay: '1.4s', duration: '5.2s' },
  { left: '66%', top: '72%', delay: '2.1s', duration: '5.6s' },
  { left: '28%', top: '78%', delay: '0.9s', duration: '4.9s' },
] as const;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to read image file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image file'));
    reader.readAsDataURL(file);
  });
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function AqquirePage() {
  const navigate = useNavigate();
  const viewerContext = useViewerContext();
  const debugMode = useDebugMode(viewerContext?.user.debugEnabled);

  const analyzeCapture = useAnalyzeCapture();
  const startCaptureProcuring = useStartCaptureProcuring();
  const finalizeCaptureProcuring = useFinalizeCaptureProcuring();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureLockRef = useRef(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('Camera unavailable. Upload an image instead.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraReady(true);
        setErrorMessage(null);
      } catch {
        setErrorMessage('Camera permission denied. Upload an image instead.');
      }
    };

    void start();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const commitCapturedImage = useCallback(async (imageDataUrl: string) => {
    if (captureLockRef.current) return;

    captureLockRef.current = true;
    setIsCapturing(true);
    setCapturedPreviewUrl(imageDataUrl);
    setErrorMessage(null);

    try {
      await sleep(1000);

      const pending = await startCaptureProcuring({ capturedImageUrl: imageDataUrl });
      void navigate('/vault');

      void (async () => {
        try {
          const response = await analyzeCapture({ imageDataUrl });
          if (!response.ok || !response.result) {
            throw new Error('Capture analysis failed');
          }

          const result = response.result as CaptureResult;

          await finalizeCaptureProcuring({
            vaultItemId: pending.vaultItemId,
            displayName: result.displayName,
            heroImageUrl: result.heroImageUrl,
            capturedImageUrl: result.capturedImageUrl,
            category: result.category,
            priceEstimate: result.priceEstimate,
            currency: result.currency,
            supplierName: result.supplierName,
            supplierUrl: result.supplierUrl,
            uniqueFlag: result.uniqueFlag,
            confidence: result.confidence,
            debugPriceBreakdown: result.debugPriceBreakdown,
          });

          window.dispatchEvent(
            new CustomEvent(AQQUIRE_PROCUREMENT_COMPLETE_EVENT, {
              detail: {
                displayName: result.displayName,
                vaultItemId: pending.vaultItemId,
              },
            }),
          );
        } catch {
          // Keep the placeholder item pending so the user doesn't see a hard failure for transient enrichment issues.
        }
      })();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Capture failed. Try again.';
      setErrorMessage(message);
      setCapturedPreviewUrl(null);
    } finally {
      setIsCapturing(false);
      captureLockRef.current = false;
    }
  }, [analyzeCapture, finalizeCaptureProcuring, navigate, startCaptureProcuring]);

  const snapLiveFrame = useCallback(async () => {
    if (!videoRef.current || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      setErrorMessage('Camera is still loading. Try again.');
      return;
    }

    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    const maxWidth = 1440;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.max(1, Math.floor(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.floor(video.videoHeight * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setErrorMessage('Unable to access capture canvas.');
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    await commitCapturedImage(imageDataUrl);
  }, [commitCapturedImage]);

  useEffect(() => {
    const handleCapture = () => {
      void snapLiveFrame();
    };

    window.addEventListener(AQQUIRE_CAPTURE_EVENT, handleCapture);
    return () => {
      window.removeEventListener(AQQUIRE_CAPTURE_EVENT, handleCapture);
    };
  }, [snapLiveFrame]);

  const onUploadSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const imageDataUrl = await fileToDataUrl(file);
      await commitCapturedImage(imageDataUrl);
    } catch {
      setErrorMessage('Upload failed. Try again.');
    }
  };

  return (
    <section className="relative h-[calc(100dvh-14.5rem)] overflow-hidden rounded-3xl border border-white/10 bg-black/40">
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void onUploadSelected(event);
        }}
      />

      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />

      {capturedPreviewUrl ? (
        <img src={capturedPreviewUrl} alt="Captured frame" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(248,220,152,0.14),transparent_42%),radial-gradient(circle_at_80%_70%,rgba(220,165,92,0.14),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0">
        {CAMERA_SPARKLES.map((sparkle, index) => (
          <span
            key={index}
            className="camera-sparkle"
            style={{
              left: sparkle.left,
              top: sparkle.top,
              animationDelay: sparkle.delay,
              animationDuration: sparkle.duration,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 border-t border-white/10 bg-black/40 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-pearl/70">
          {!cameraReady ? <span>Initializing camera</span> : <span />}
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="pointer-events-auto rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-pearl/85"
          >
            Upload
          </button>
        </div>

        {debugMode ? (
          <p className="text-[11px] uppercase tracking-[0.14em] text-champagne/80">
            Debug enabled: capture uses OpenAI visual target + web lookup.
          </p>
        ) : null}

        {errorMessage ? <p className="text-xs uppercase tracking-[0.14em] text-rose-200">{errorMessage}</p> : null}
      </div>

      {isCapturing ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65">
          <div className="rounded-full border border-champagne/45 bg-champagne/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-champagne">
            Capturing
          </div>
        </div>
      ) : null}
    </section>
  );
}
