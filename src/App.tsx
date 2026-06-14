// src/App.tsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, BrowserRouter, useNavigate } from 'react-router-dom';
import { AppShell, Loader, Center, Button, Notification, MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Notifications } from '@mantine/notifications';
import Navbar from './components/common/Navbar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initDatabase, getDb, isDatabaseConnected } from './database/db';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// ==================== FACTURES DÉTAILS (imports directs car utilisés dans les routes) ====================
import DetailFacture from './components/factures/DetailFacture';
import DetailFactureRevendeur from './components/factures/DetailFactureRevendeur';

// ==================== AUTH ====================
const Login = lazy(() => import('./components/auth/Login'));

// ==================== DASHBOARD ====================
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));

// ==================== GESTION COMMERCIALE ====================
const ListeClients = lazy(() => import('./components/clients/ListeClients'));
const ListeFactures = lazy(() => import('./components/factures/ListeFactures'));
const ListeVentes = lazy(() => import('./components/ventes/ListeVentes'));
const ListeCommandes = lazy(() => import('./components/commandes/ListeCommandes').then(module => ({ default: module.ListeCommande })));
const FormulaireCommande = lazy(() => import('./components/commandes/FormulaireCommande'));

// ==================== REVENDEURS ====================
// Some commande-related components are exported from the main ListeCommandes file
const ListeCommandesRevendeur = lazy(() => import('./components/commandes/ListeCommandes').then(module => ({ default: (module as any).ListeCommandesRevendeur || (module as any).ListeCommande })));
const ListeFacturesRevendeur = lazy(() => import('./components/factures/ListeFacturesRevendeur'));
const DetailDecompte = lazy(() => import('./components/decomptes/DetailDecompte'));
const PrintRecuDecompte = lazy(() => import('./components/decomptes/PrintRecuDecompte'));
const HistoriqueRevendeur = lazy(() => import('./components/pages/revendeurs/HistoriqueRevendeur'));
const ListeStockRevendeur = lazy(() => import('./components/pages/revendeurs/ListeStockRevendeur'));
const DashboardRevendeurs = lazy(() => import('./components/pages/revendeurs/DashboardRevendeurs'));
const NouveauDecompte = lazy(() => import('./components/decomptes/NouveauDecompte'));

// ==================== PRODUITS & STOCK ====================
const ListeProduits = lazy(() => import('./components/products/ListeProduits'));

// ==================== FINANCES ====================
const ListeDecomptes = lazy(() => import('./components/decomptes/ListeDecomptes'));
const ListeReglements = lazy(() => import('./components/reglements/ListeReglements'));

// ==================== PARAMÈTRES ====================
const ListeUtilisateurs = lazy(() => import('./components/utilisateurs/ListeUtilisateurs'));
const ParametresAtelier = lazy(() => import('./components/parametres/ParametresAtelier'));
const ConfigCommerce = lazy(() => import('./components/parametres/ConfigCommerce'));

// ==================== TYPES ====================
type PageKey =
  | 'dashboard'
  | 'clients'
  | 'commandes'
  | 'factures'
  | 'ventes'
  | 'products'
  | 'stock'
  | 'decomptes'
  | 'reglements'
  | 'utilisateurs'
  | 'parametres'
  | 'commandes-revendeur'
  | 'dashboard-revendeurs'
  | 'stock-revendeurs'
  | 'factures-revendeur'
  | 'revendeurs-historique';

// ==================== COMPOSANTS ====================
const LoadingFallback = () => (
  <Center style={{ height: '100vh' }}>
    <Loader size="xl" variant="dots" />
  </Center>
);

// Vérification de la base de données (sans réinitialisation)
function DatabaseStatus() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkDb = async () => {
      try {
        console.log('🔄 Vérification de la base de données...');

        if (isDatabaseConnected()) {
          const db = await getDb();

          const tables = await db.select<{ count: number }[]>(`
            SELECT COUNT(*) as count FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
          `);

          console.log(`✅ Base de données prête - ${tables[0]?.count || 0} tables disponibles`);
          setIsReady(true);
        } else {
          throw new Error('Connexion DB échouée');
        }
      } catch (err) {
        console.error('❌ Erreur DB:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    };

    checkDb();
  }, []);

  if (error) {
    return (
      <Center style={{ height: '100vh' }}>
        <Notification title="Erreur Base de données" color="red">
          {error}
          <Button onClick={() => window.location.reload()} size="xs" mt="md">
            Réessayer
          </Button>
        </Notification>
      </Center>
    );
  }

  if (!isReady) {
    return <LoadingFallback />;
  }

  return null;
}

function RouteGuard({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return <Login />;
  if (roles && user && !roles.includes(user.role)) {
    return (
      <Center style={{ height: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>⛔ Accès non autorisé</h2>
          <p>Vous n'avez pas les permissions nécessaires.</p>
          <Button onClick={() => navigate('/')} mt="md">Retour au Dashboard</Button>
        </div>
      </Center>
    );
  }
  return <>{children}</>;
}

// Wrapper pour NouveauDecompte avec navigation
function NouveauDecompteWrapper() {
  const navigate = useNavigate();

  return (
    <NouveauDecompte
      onSuccess={() => navigate('/decomptes')}
      onCancel={() => navigate('/decomptes')}
    />
  );
}

// Wrapper pour PrintRecuDecompte avec useParams (handled inside Routes)

// ==================== APP AUTHENTIFIÉE ====================
function AuthenticatedApp() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm("Voulez-vous vous déconnecter ?")) {
      logout();
      navigate('/login');
    }
  };

  const handleSetPage = (page: PageKey) => {
    const routeMap: Record<PageKey, string> = {
      dashboard: '/',
      clients: '/clients',
      commandes: '/commandes',
      factures: '/factures',
      ventes: '/ventes',
      products: '/products',
      stock: '/stock',
      decomptes: '/decomptes',
      reglements: '/reglements',
      utilisateurs: '/utilisateurs',
      parametres: '/parametres',
      'commandes-revendeur': '/commandes-revendeur',
      'dashboard-revendeurs': '/dashboard-revendeurs',
      'stock-revendeurs': '/stock-revendeurs',
      'factures-revendeur': '/factures-revendeur',
      'revendeurs-historique': '/revendeurs/historique'
    };
    navigate(routeMap[page] || '/');
  };

  if (loading) return <LoadingFallback />;
  if (!isAuthenticated) return <Login />;

  return (
    <AppShell
      padding="md"
      navbar={{ width: 260, breakpoint: 'sm' }}
      styles={{ main: { height: '100%', overflow: 'auto', backgroundColor: '#f5f7fa' } }}
    >
      <AppShell.Navbar>
        <Navbar userRole={user?.role} userName={user?.nom} onLogout={handleLogout} />
      </AppShell.Navbar>
      <AppShell.Main>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* DASHBOARD */}
            <Route path="/" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <Dashboard setPage={handleSetPage} />
              </RouteGuard>
            } />

            {/* GESTION COMMERCIALE */}
            <Route path="/clients" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeClients />
              </RouteGuard>
            } />
            <Route path="/commandes" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeCommandes />
              </RouteGuard>
            } />
            <Route path="/commandes/nouveau" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <FormulaireCommande opened={true} onClose={() => { }} />
              </RouteGuard>
            } />
            <Route path="/factures" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeFactures />
              </RouteGuard>
            } />

            {/* DÉTAILS FACTURES */}
            <Route path="/factures/:id" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <DetailFacture />
              </RouteGuard>
            } />

            <Route path="/factures-revendeur/:id" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <DetailFactureRevendeur />
              </RouteGuard>
            } />

            <Route path="/ventes" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeVentes />
              </RouteGuard>
            } />

            {/* REVENDEURS */}
            <Route path="/dashboard-revendeurs" element={
              <RouteGuard roles={['admin']}>
                <DashboardRevendeurs />
              </RouteGuard>
            } />
            <Route path="/commandes-revendeur" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeCommandesRevendeur />
              </RouteGuard>
            } />
            <Route path="/factures-revendeur" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeFacturesRevendeur />
              </RouteGuard>
            } />
            <Route path="/stock-revendeurs" element={
              <RouteGuard roles={['admin']}>
                <ListeStockRevendeur />
              </RouteGuard>
            } />
            <Route path="/revendeurs/historique" element={
              <RouteGuard roles={['admin']}>
                <HistoriqueRevendeur />
              </RouteGuard>
            } />

            {/* PRODUITS & STOCK */}
            <Route path="/products" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeProduits />
              </RouteGuard>
            } />
            {/* FINANCES */}
            <Route path="/decomptes" element={
              <RouteGuard roles={['admin']}>
                <ListeDecomptes />
              </RouteGuard>
            } />
            <Route path="/decomptes/nouveau" element={
              <RouteGuard roles={['admin']}>
                <NouveauDecompteWrapper />
              </RouteGuard>
            } />
            <Route path="/decomptes/:id" element={
              <RouteGuard roles={['admin']}>
                <DetailDecompte />
              </RouteGuard>
            } />
            <Route path="/decomptes/:id/print" element={
              <RouteGuard roles={['admin']}>
                <PrintRecuDecompte />
              </RouteGuard>
            } />
            <Route path="/reglements" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeReglements />
              </RouteGuard>
            } />

            {/* PARAMÈTRES */}
            <Route path="/utilisateurs" element={
              <RouteGuard roles={['admin']}>
                <ListeUtilisateurs />
              </RouteGuard>
            } />
            <Route path="/parametres" element={
              <RouteGuard roles={['admin']}>
                <ParametresAtelier />
              </RouteGuard>
            } />
            <Route path="/config-commerce" element={
              <RouteGuard roles={['admin']}>
                <ConfigCommerce />
              </RouteGuard>
            } />

            {/* 404 */}
            <Route path="*" element={
              <Center style={{ height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                  <h2>🔍 404 - Page non trouvée</h2>
                  <p>La page que vous recherchez n'existe pas.</p>
                  <Button onClick={() => navigate('/')} mt="md">Retour au Dashboard</Button>
                </div>
              </Center>
            } />
          </Routes>
        </Suspense>
      </AppShell.Main>
    </AppShell>
  );
}

// ==================== QUERY CLIENT ====================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false
    }
  },
});

// ==================== APP PRINCIPALE ====================
function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const setup = async () => {
      try {
        await initDatabase();
        setDbReady(true);
      } catch (error: any) {
        const errorMsg = error?.message || 'Erreur inconnue';
        console.error('Erreur DB fatale:', errorMsg);
        setDbReady(false);
      }
    };
    setup();
  }, []);

  if (!dbReady) {
    return <LoadingFallback />;
  }

  return (
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Notifications position="top-right" />
            <DatabaseStatus />
            <AuthenticatedApp />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  );
}

export default App;