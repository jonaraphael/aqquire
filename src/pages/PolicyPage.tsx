import { Link } from 'react-router-dom';
import { usePolicy } from '@/lib/localBackend';

export function PolicyPage() {
  const policy = usePolicy();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-champagne">AQQUIRE Policy</h1>
        <Link
          to="/vault/profile"
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.16em] text-pearl/75"
        >
          Back
        </Link>
      </div>

      <article className="rounded-3xl border border-white/12 bg-white/[0.04] p-5 text-sm leading-7 text-pearl/80">
        {(policy?.text ?? '').split('\n\n').map((paragraph: string, index: number) => (
          <p key={index} className="mb-4 whitespace-pre-line last:mb-0">
            {paragraph}
          </p>
        ))}
      </article>

      <p className="text-xs uppercase tracking-[0.16em] text-pearl/50">
        Counsel review recommended for jurisdiction-specific enforceability.
      </p>
    </section>
  );
}
