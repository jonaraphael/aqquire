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
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280,
        color: {
          dark: '#17120b',
          light: '#f4eee2',
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
    <div className={cn('inline-flex rounded-3xl border border-champagne/35 bg-obsidian/80 p-4', className)}>
      {qrSrc ? (
        <img src={qrSrc} alt="Follow QR" className="h-[220px] w-[220px] rounded-xl bg-pearl p-2 shadow-[0_8px_28px_rgba(0,0,0,0.4)]" />
      ) : (
        <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl bg-pearl/15 text-xs uppercase tracking-[0.14em] text-pearl/70">
          Generating QR
        </div>
      )}
    </div>
  );
}
