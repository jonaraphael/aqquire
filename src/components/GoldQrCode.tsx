import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface GoldQrCodeProps {
  token: string;
  className?: string;
}

function seededBit(seed: string, x: number, y: number) {
  let hash = 2166136261;
  const input = `${seed}:${x}:${y}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2;
}

function finder(x: number, y: number, ox: number, oy: number) {
  const lx = x - ox;
  const ly = y - oy;
  if (lx < 0 || ly < 0 || lx > 6 || ly > 6) return false;
  if (lx === 0 || ly === 0 || lx === 6 || ly === 6) return true;
  if (lx === 1 || ly === 1 || lx === 5 || ly === 5) return false;
  return true;
}

export function GoldQrCode({ token, className }: GoldQrCodeProps) {
  const cells = useMemo(() => {
    const size = 29;
    const matrix: boolean[] = [];

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const isFinder = finder(x, y, 1, 1) || finder(x, y, size - 8, 1) || finder(x, y, 1, size - 8);
        matrix.push(isFinder ? true : seededBit(token, x, y) === 1);
      }
    }

    return { size, matrix };
  }, [token]);

  return (
    <div className={cn('inline-flex rounded-3xl border border-champagne/35 bg-obsidian/80 p-4', className)}>
      <div
        className="qr-grid grid gap-[2px] rounded-xl bg-pearl/8 p-2"
      >
        {cells.matrix.map((on, index) => (
          <span
            key={index}
            className={cn('h-[6px] w-[6px] rounded-[1px]', on ? 'bg-champagne' : 'bg-transparent')}
          />
        ))}
      </div>
    </div>
  );
}
