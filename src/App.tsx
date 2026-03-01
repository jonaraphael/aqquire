import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth';
import { useBootstrap } from '@/hooks/useBootstrap';
import { FeedPage } from '@/pages/FeedPage';
import { AqquirePage } from '@/pages/AqquirePage';
import { VaultPage } from '@/pages/VaultPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PolicyPage } from '@/pages/PolicyPage';
import { AuthLanding } from '@/pages/AuthLanding';

export default function App() {
  const { isLoading, user } = useAuth();
  const useHashRouter = import.meta.env.VITE_ROUTER_MODE === 'hash';
  const browserBasename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL;

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-luxury px-4 text-sm uppercase tracking-[0.2em] text-champagne/80">
        Loading
      </div>
    );
  }

  return (
    <>
      {useHashRouter ? (
        <HashRouter>{user ? <BootstrappedRoutes /> : <AuthLanding />}</HashRouter>
      ) : (
        <BrowserRouter basename={browserBasename}>{user ? <BootstrappedRoutes /> : <AuthLanding />}</BrowserRouter>
      )}
    </>
  );
}

function BootstrappedRoutes() {
  useBootstrap(true);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/aqquire" replace />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/aqquire" element={<AqquirePage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/vault/profile" element={<ProfilePage />} />
        <Route path="/vault/policy" element={<PolicyPage />} />
        <Route path="*" element={<Navigate to="/aqquire" replace />} />
      </Route>
    </Routes>
  );
}
