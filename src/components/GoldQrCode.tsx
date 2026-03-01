import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';

interface GoldQrCodeProps {
  token: string;
  className?: string;
}

export function GoldQrCode({ token, className }: GoldQrCodeProps) {
  const [qrSrc, setQrSrc] = useState<string>('');

  useEffect(() => {
    let active = true;

    const run = async () => {
      const payload = `aqquire://follow/${token}`;
      const dataUrl = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'Q',
        margin: 2,
        width: 300,
        color: {
          dark: '#7b5618',
          light: '#f8ecd1',
        },
      });

      if (active) {
        setQrSrc(dataUrl);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div
      className={cn(
        'relative inline-flex rounded-3xl border border-champagne/45 bg-gradient-to-br from-[#f8e1b030] via-[#d8ab6240] to-[#8f64292f] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_18%_12%,rgba(255,236,189,0.18),transparent_40%),radial-gradient(circle_at_84%_76%,rgba(224,171,87,0.14),transparent_44%)]" />
      {qrSrc ? (
        <div className="relative z-10 rounded-2xl border border-champagne/45 bg-gradient-to-br from-[#fbe8c0] via-[#f2d596] to-[#d7a95a] p-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_8px_28px_rgba(0,0,0,0.38)]">
          <img src={qrSrc} alt="Follow QR" className="h-[220px] w-[220px] rounded-lg bg-[#f8ecd1] p-2" />
        </div>
      ) : (
        <div className="relative z-10 flex h-[220px] w-[220px] items-center justify-center rounded-xl bg-pearl/15 text-xs uppercase tracking-[0.14em] text-pearl/70">
          Generating QR
        </div>
      )}
    </div>
  );
}
