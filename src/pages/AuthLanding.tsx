import { useAuth } from '@/lib/auth';

export function AuthLanding() {
  const { signIn } = useAuth();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-luxury px-4">
      <div className="w-full max-w-md rounded-3xl border border-champagne/30 bg-black/35 p-8 text-center">
        <p className="font-display text-4xl tracking-[0.2em] text-champagne">AQQUIRE</p>
        <p className="mt-2 text-xs uppercase tracking-[0.24em] text-pearl/60">Want it. Get it.</p>

        <button
          type="button"
          onClick={() => void signIn()}
          className="mt-7 w-full rounded-full border border-champagne/45 bg-champagne/15 px-5 py-3 text-xs uppercase tracking-[0.24em] text-champagne"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
