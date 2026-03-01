import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CATEGORY_OPTIONS } from '@/lib/constants';
import { FeedCard } from '@/components/FeedCard';
import { cn, parseFollowToken } from '@/lib/utils';
import { useDebugMode } from '@/hooks/useDebugMode';
import {
  useCommitFeedItemToVault,
  useFollowByToken,
  useListFeed,
  useViewerContext,
} from '@/lib/localBackend';

export function FeedPage() {
  const viewerContext = useViewerContext();
  const debugMode = useDebugMode(viewerContext?.user.debugEnabled);

  const commitFeed = useCommitFeedItemToVault();
  const followByToken = useFollowByToken();

  const [enabledCategories, setEnabledCategories] = useState<string[]>([...CATEGORY_OPTIONS]);
  const [followOpen, setFollowOpen] = useState(false);
  const [followInput, setFollowInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(8);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const feedData = useListFeed({
    categories: enabledCategories as Array<(typeof CATEGORY_OPTIONS)[number]>,
    limit: 240,
    cursor: 0,
    debug: debugMode,
  });

  const items = feedData?.items ?? [];
  const visibleItems = items.slice(0, visibleCount);
  const canUseCamera = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const scannerMessage = cameraError ?? (followOpen && !canUseCamera ? 'Camera unavailable. Paste follow token instead.' : null);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + 6, items.length));
        }
      },
      { rootMargin: '220px' },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    if (!followOpen || !videoRef.current) return;

    if (!canUseCamera) {
      return;
    }

    let active = true;
    const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;

    const run = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current!.srcObject = stream;
        await videoRef.current!.play();
        setCameraError(null);

        const scanLoop = async () => {
          if (!active || !videoRef.current) return;

          try {
            let raw = '';

            if (detector) {
              const barcodes = await detector.detect(videoRef.current);
              raw = barcodes[0]?.rawValue ?? '';
            }

            if (!raw && canvasRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
              const canvas = canvasRef.current;
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;

              const context = canvas.getContext('2d', { willReadFrequently: true });
              if (context) {
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'attemptBoth',
                });
                raw = decoded?.data ?? '';
              }
            }

            if (raw) {
              const token = parseFollowToken(raw);
              if (token) {
                setFollowInput(token);
              }
            }
          } catch {
            // Intentionally swallowed: this loop is best effort.
          }
          window.requestAnimationFrame(() => {
            void scanLoop();
          });
        };

        await scanLoop();
      } catch {
        setCameraError('Camera access denied. Paste follow token instead.');
      }
    };

    void run();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [followOpen, canUseCamera]);

  const toggleCategory = (category: (typeof CATEGORY_OPTIONS)[number]) => {
    setVisibleCount(8);
    setEnabledCategories((current) => {
      if (current.includes(category)) {
        const next = current.filter((entry) => entry !== category);
        return next.length === 0 ? [...CATEGORY_OPTIONS] : next;
      }
      return [...current, category];
    });
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1400);
  };

  const handleFollow = async () => {
    const token = parseFollowToken(followInput);
    if (!token) return;

    try {
      const response = await followByToken({ followToken: token });
      if (response.followed) {
        showToast(`Following ${response.handle}`);
        setFollowOpen(false);
        setFollowInput('');
      } else if (response.reason === 'already_following') {
        showToast(`Already following ${response.handle}`);
      } else if (response.reason === 'self') {
        showToast('That token is yours');
      }
    } catch {
      showToast('Follow token not recognized');
    }
  };

  return (
    <section className="space-y-4">
      <div className="sticky top-0 z-30 -mx-3 border-b border-white/10 bg-obsidian/95 px-3 pb-3 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl tracking-[0.12em] text-pearl">Feed</h1>
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              setFollowOpen(true);
            }}
            className="rounded-full border border-champagne/45 bg-champagne/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-champagne hover:bg-champagne/20"
          >
            Follow
          </button>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {CATEGORY_OPTIONS.map((category) => {
            const active = enabledCategories.includes(category);
            return (
              <label
                key={category}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition',
                  active
                    ? 'border-champagne/50 bg-champagne/12 text-champagne'
                    : 'border-white/20 bg-white/5 text-pearl/70',
                )}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleCategory(category)}
                  className="accent-[#d6ae5c]"
                />
                {category}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {visibleItems.map((item: any) => (
          <FeedCard
            key={item._id}
            item={item}
            debugMode={debugMode}
            onCommit={async (itemId, interaction) => {
              await commitFeed({ feedItemId: itemId, interaction });
              showToast('In Vault');
            }}
          />
        ))}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-pearl/70">No items in this filter.</div>
        ) : null}

        <div ref={sentinelRef} className="h-10" />
      </div>

      {followOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 md:items-center md:justify-center">
          <div className="w-full max-w-md rounded-3xl border border-champagne/30 bg-obsidian/95 p-4 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl text-champagne">Follow Scanner</h2>
              <button
                type="button"
                onClick={() => {
                  setCameraError(null);
                  setFollowOpen(false);
                }}
                className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.12em]"
              >
                Close
              </button>
            </div>

            <video ref={videoRef} muted playsInline className="mb-3 aspect-square w-full rounded-2xl bg-black/60 object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {scannerMessage ? <p className="mb-2 text-xs text-pearl/60">{scannerMessage}</p> : null}

            <div className="space-y-2">
              <input
                value={followInput}
                onChange={(event) => setFollowInput(event.target.value)}
                placeholder="aqquire://follow/<token>"
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none ring-champagne focus:ring"
              />
              <button
                type="button"
                onClick={() => void handleFollow()}
                className="w-full rounded-xl border border-champagne/45 bg-champagne/15 px-4 py-2 text-xs uppercase tracking-[0.2em] text-champagne"
              >
                Confirm Follow
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full border border-champagne/40 bg-obsidian/95 px-4 py-2 text-xs uppercase tracking-[0.2em] text-champagne shadow-xl">
          {toast}
        </div>
      ) : null}
    </section>
  );
}

// BarcodeDetector exists in modern Chromium browsers.
declare global {
  interface Window {
    BarcodeDetector: {
      new (options?: { formats?: string[] }): {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    };
  }
}
