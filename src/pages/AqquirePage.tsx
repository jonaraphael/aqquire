import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { currency } from '@/lib/utils';
import { useDebugMode } from '@/hooks/useDebugMode';
import { useAnalyzeCapture, useAqquireIt, useViewerContext } from '@/lib/localBackend';

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

export function AqquirePage() {
  const viewerContext = useViewerContext();
  const debugMode = useDebugMode(viewerContext?.user.debugEnabled);

  const analyzeCapture = useAnalyzeCapture();
  const aqquireIt = useAqquireIt();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const triggerCapture = () => fileInputRef.current?.click();

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1500);
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    setIsAnalyzing(true);

    try {
      const imageDataUrl = await fileToDataUrl(file);
      const response = await analyzeCapture({ imageDataUrl });

      if (!response.ok || !response.result) {
        setResult(null);
        setErrorMessage('Try again');
        return;
      }

      setResult(response.result as CaptureResult);
    } catch {
      setErrorMessage('Try again');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAqquire = async () => {
    if (!result) return;

    await aqquireIt({
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

    showToast('In Vault');
  };

  return (
    <section className="relative flex h-[calc(100dvh-14.5rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void onFileSelected(event);
        }}
      />

      {!result ? (
        <div className="relative flex h-full flex-col items-center justify-center gap-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(248,220,152,0.16),transparent_40%),radial-gradient(circle_at_80%_65%,rgba(220,165,92,0.12),transparent_45%)]" />

          <div className="relative text-center">
            <p className="font-display text-4xl tracking-[0.2em] text-champagne">AQQUIRE</p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-pearl/60">Camera First Command</p>
          </div>

          <button
            type="button"
            disabled={isAnalyzing}
            onClick={triggerCapture}
            className="relative h-40 w-40 rounded-full border border-champagne bg-gradient-to-b from-[#f6e7bd] via-[#d8b66f] to-[#9f742f] text-sm font-semibold uppercase tracking-[0.24em] text-obsidian shadow-[0_0_0_6px_rgba(255,217,133,0.1),0_24px_80px_rgba(0,0,0,0.4)] disabled:opacity-60"
          >
            {isAnalyzing ? 'Reading' : 'Capture'}
          </button>

          {errorMessage ? <p className="text-sm uppercase tracking-[0.18em] text-champagne">{errorMessage}</p> : null}
        </div>
      ) : (
        <div className="flex h-full flex-col justify-between gap-4 overflow-hidden">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/35">
            <img src={result.heroImageUrl} alt={result.displayName} className="h-[48dvh] w-full object-cover" />
          </div>

          <div className="space-y-4">
            <div>
              <p className="font-display text-3xl text-pearl">{result.displayName}</p>
              <p className="text-sm uppercase tracking-[0.18em] text-pearl/60">
                {currency(result.priceEstimate, result.currency)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleAqquire()}
                className="rounded-full border border-champagne bg-champagne/20 px-4 py-3 text-xs uppercase tracking-[0.24em] text-champagne"
              >
                AQQUIRE IT
              </button>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setErrorMessage(null);
                }}
                className="rounded-full border border-white/25 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.2em] text-pearl/75"
              >
                Dismiss
              </button>
            </div>

            {debugMode ? (
              <div className="rounded-2xl border border-champagne/25 bg-black/40 p-3 text-xs text-pearl/75">
                <p>Supplier: {result.supplierName ?? 'N/A'}</p>
                <p>Link: {result.supplierUrl ?? 'N/A'}</p>
                <p>Confidence: {result.confidence?.toFixed(3) ?? 'N/A'}</p>
                <p>
                  Breakdown: {result.debugPriceBreakdown?.baseCost ?? 0} / {result.debugPriceBreakdown?.shipping ?? 0} /
                  {' '}
                  {result.debugPriceBreakdown?.serviceFee ?? 0}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {toast ? (
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-champagne/40 bg-obsidian/95 px-4 py-2 text-xs uppercase tracking-[0.2em] text-champagne">
          {toast}
        </div>
      ) : null}
    </section>
  );
}
