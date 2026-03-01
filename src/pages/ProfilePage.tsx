import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoldQrCode } from '@/components/GoldQrCode';
import { currency } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import {
  useCreateVaultSetupCheckout,
  useRotateFollowToken,
  useSaveVaultSetup,
  useVaultProfile,
} from '@/lib/localBackend';

function readFormValue(form: FormData, key: string, fallback = '') {
  const value = form.get(key);
  return typeof value === 'string' ? value : fallback;
}

export function ProfilePage() {
  const { signOut } = useAuth();

  const profile = useVaultProfile();

  const saveVaultSetup = useSaveVaultSetup();
  const rotateFollowToken = useRotateFollowToken();
  const createVaultSetupCheckout = useCreateVaultSetupCheckout();

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!profile) {
    return <div className="rounded-2xl border border-white/12 bg-white/5 p-6 text-sm text-pearl/70">Loading profile...</div>;
  }

  const defaultPayment = profile.defaultPaymentMethod as any;
  const defaultShipping = profile.defaultShippingAddress as any;
  const topSpenderPercentLabel = profile.spenderPercentile >= 10
    ? profile.spenderPercentile.toFixed(1)
    : profile.spenderPercentile.toFixed(2);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    setStatusMessage(null);

    try {
      const paymentTypeRaw = readFormValue(form, 'paymentType', 'card');
      const paymentType = paymentTypeRaw === 'bank' ? 'bank' : 'card';

      await saveVaultSetup({
        paymentType,
        paymentLabel: readFormValue(form, 'paymentLabel', 'Premier Card'),
        paymentLast4: readFormValue(form, 'paymentLast4', '4242'),
        addressLabel: readFormValue(form, 'addressLabel', 'Primary Residence'),
        line1: readFormValue(form, 'line1'),
        line2: readFormValue(form, 'line2'),
        city: readFormValue(form, 'city'),
        state: readFormValue(form, 'state'),
        postalCode: readFormValue(form, 'postalCode'),
        country: readFormValue(form, 'country', 'US'),
      });

      setStatusMessage('Vault Setup saved');
    } catch {
      setStatusMessage('Vault Setup failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/12 bg-white/[0.04] p-5">
        <p className="font-display text-3xl text-pearl">{profile.displayHandle}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-pearl/60">Tier {profile.tier}</p>
        <p className="mt-1 text-sm text-pearl/80">Top {topSpenderPercentLabel}% of spenders</p>
        <p className="mt-1 text-sm text-pearl/80">Settled spend: {currency(profile.lifetimeSpendSettled)}</p>
      </div>

      <div className="rounded-3xl border border-champagne/35 bg-gradient-to-br from-[#f0d6a019] to-[#a67a3550] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl text-champagne">Vault Setup</h2>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                try {
                  const origin = window.location.origin;
                  const response = await createVaultSetupCheckout({
                    successUrl: `${origin}/vault/profile?setup=success`,
                    cancelUrl: `${origin}/vault/profile?setup=cancel`,
                  });
                  if (response.url) {
                    window.open(response.url, '_blank', 'noopener,noreferrer');
                  }
                } catch {
                  setStatusMessage('Stripe setup unavailable');
                }
              })();
            }}
            className="rounded-full border border-champagne/45 bg-champagne/15 px-4 py-2 text-xs uppercase tracking-[0.2em] text-champagne"
          >
            Stripe Setup
          </button>
        </div>

        <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70">
            Payment Type
            <select
              name="paymentType"
              defaultValue={defaultPayment?.type ?? 'card'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            >
              <option value="card">Card</option>
              <option value="bank">Bank</option>
            </select>
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70">
            Payment Label
            <input
              name="paymentLabel"
              defaultValue={defaultPayment?.label ?? 'Premier Card'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70">
            Last 4
            <input
              name="paymentLast4"
              maxLength={4}
              defaultValue={defaultPayment?.last4 ?? '4242'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70">
            Address Label
            <input
              name="addressLabel"
              defaultValue={defaultShipping?.label ?? 'Primary Residence'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70 md:col-span-2">
            Line 1
            <input
              name="line1"
              defaultValue={defaultShipping?.line1 ?? '500 Fifth Avenue'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70 md:col-span-2">
            Line 2
            <input
              name="line2"
              defaultValue={defaultShipping?.line2 ?? 'Penthouse 8'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70">
            City
            <input
              name="city"
              defaultValue={defaultShipping?.city ?? 'New York'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70">
            State
            <input
              name="state"
              defaultValue={defaultShipping?.state ?? 'NY'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70">
            Postal Code
            <input
              name="postalCode"
              defaultValue={defaultShipping?.postalCode ?? '10001'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-pearl/70">
            Country
            <input
              name="country"
              defaultValue={defaultShipping?.country ?? 'US'}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="md:col-span-2 rounded-full border border-champagne/40 bg-champagne/16 px-5 py-3 text-xs uppercase tracking-[0.2em] text-champagne disabled:opacity-65"
          >
            {saving ? 'Saving' : 'Save Vault Setup'}
          </button>
        </form>

        {statusMessage ? <p className="mt-3 text-xs uppercase tracking-[0.16em] text-champagne/90">{statusMessage}</p> : null}
      </div>

      <div className="rounded-3xl border border-champagne/35 bg-black/30 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl text-champagne">Follow QR</h2>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                await rotateFollowToken();
                setStatusMessage('Follow token rotated');
              })();
            }}
            className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.12em] text-pearl/75"
          >
            Rotate
          </button>
        </div>

        <GoldQrCode token={profile.followToken} />
        <p className="mt-3 break-all text-xs text-pearl/70">{profile.followUri}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/vault/policy"
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.17em] text-pearl/75"
        >
          Policy
        </Link>
        <button
          type="button"
          onClick={() => {
            void signOut();
          }}
          className="rounded-full border border-rose-200/35 bg-rose-500/10 px-4 py-2 text-xs uppercase tracking-[0.17em] text-rose-100"
        >
          Sign out
        </button>
      </div>
    </section>
  );
}
