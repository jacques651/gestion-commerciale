// src/components/common/PageBanner.tsx
// Bannière de page posée par App.tsx (masquée sur /print et /reçu).
import { useLocation } from 'react-router-dom';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import { routeTitle } from './navConfig';

export const isPrintRoute = (pathname: string): boolean => {
  let p = pathname;
  try { p = decodeURIComponent(pathname); } catch { /* ignore */ }
  return /\/(print|reçu)(\/|$)/.test(p);
};

export default function PageBanner() {
  const { pathname } = useLocation();
  const { config } = useAtelierConfig();
  if (isPrintRoute(pathname)) return null;

  return (
    <header className="tk-page-banner">
      <div className="tk-page-banner-eyebrow">{config?.nom_atelier ?? ''}</div>
      <h1 className="tk-page-banner-title">{routeTitle(pathname)}</h1>
    </header>
  );
}
