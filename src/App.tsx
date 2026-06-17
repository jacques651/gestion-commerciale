// src/App.tsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, BrowserRouter, useNavigate } from 'react-router-dom';
import { AppShell, Loader, Center, Button, Notification, MantineProvider, Stack, Text } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Notifications } from '@mantine/notifications';
import Navbar from './components/common/Navbar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getDb, isDatabaseConnected } from './database/db';
import { initDatabaseWithMigrations } from './database/runMigration';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// ==================== FACTURES DÉTAILS (imports directs car utilisés dans les routes) ====================
import DetailFacture from './components/factures/DetailFacture';
import DetailFactureRevendeur from './components/factures/DetailFactureRevendeur';
import ListeCommandes from './components/commandes/ListeCommandes';

// ==================== AUTH ====================
const Login = lazy(() => import('./components/auth/Login'));

// ==================== DASHBOARD ====================
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));

// ==================== GESTION COMMERCIALE ====================
const ListeClients = lazy(() => import('./components/clients/ListeClients'));
const ListeFactures = lazy(() => import('./components/factures/ListeFactures'));
const ListeVentes = lazy(() => import('./components/ventes/ListeVentes'));

const ListeCommandeStandard = lazy(() => import('./components/commandes/ListeCommandeStandard'));
const ListeCommandesRevendeur = lazy(() => import('./components/commandes/ListeCommandesRevendeur'));
const FormulaireCommande = lazy(() => import('./components/commandes/FormulaireCommande'));

// ==================== REVENDEURS ====================
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

// ==================== CAISSE ====================
const JournalCaisse = lazy(() => import('./components/caisse/JournalCaisse'));
const ChargesFonctionnement = lazy(() => import('./components/caisse/ChargesFonctionnement'));

// ==================== CRÉDITS ====================
const ListeCredits = lazy(() => import('./components/credits/ListeCredits'));
const RemboursementsList = lazy(() => import('./components/credits/RemboursementsList'));

// ==================== PARAMÈTRES ====================
const ListeUtilisateurs = lazy(() => import('./components/utilisateurs/ListeUtilisateurs'));
const ParametresAtelier = lazy(() => import('./components/parametres/ParametresAtelier'));
const DiagnosticDB = lazy(() => import('./components/DiagnosticDB'));

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
  | 'credits'
  | 'remboursements'
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
      credits: '/credits',
      remboursements: '/remboursements',
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
            
            {/* Commandes */}
            <Route path="/commandes" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeCommandes />
              </RouteGuard>
            } />
            <Route path="/commandes/standard" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeCommandeStandard />
              </RouteGuard>
            } />
            <Route path="/commandes/revendeur" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeCommandesRevendeur />
              </RouteGuard>
            } />
            <Route path="/commandes/nouveau" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <FormulaireCommande opened={true} onClose={() => {}} />
              </RouteGuard>
            } />
            
            {/* Factures */}
            <Route path="/factures" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeFactures />
              </RouteGuard>
            } />
            <Route path="/factures-revendeur" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeFacturesRevendeur />
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

            {/* 🔥 CAISSE */}
            <Route path="/caisse" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <JournalCaisse />
              </RouteGuard>
            } />
            <Route path="/charges" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ChargesFonctionnement />
              </RouteGuard>
            } />

            {/* 🔥 CRÉDITS */}
            <Route path="/credits" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <ListeCredits />
              </RouteGuard>
            } />

            {/* 🔥 REMBOURSEMENTS */}
            <Route path="/remboursements" element={
              <RouteGuard roles={['admin', 'gestionnaire']}>
                <RemboursementsList />
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

            <Route path="/diagnostic" element={
              <RouteGuard roles={['admin']}>
                <DiagnosticDB />
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
  const [migrationRunning, setMigrationRunning] = useState(true);

  useEffect(() => {
    const setup = async () => {
      try {
        console.log('🚀 Démarrage de l\'application...');
        
        // 🔥 Exécuter la migration complète avec le schéma
        await initDatabaseWithMigrations();
        
        console.log('✅ Base de données initialisée avec succès');
        setDbReady(true);
      } catch (error: any) {
        const errorMsg = error?.message || 'Erreur inconnue';
        console.error('❌ Erreur DB fatale:', errorMsg);
        setDbReady(false);
      } finally {
        setMigrationRunning(false);
      }
    };
    setup();
  }, []);

  // Afficher un loader pendant la migration
  if (migrationRunning) {
    return (
      <Center style={{ height: '100vh' }}>
        <Stack align="center" gap="md">
          <Loader size="xl" variant="dots" />
          <Text size="lg" fw={600}>Initialisation de la base de données...</Text>
          <Text size="sm" c="dimmed">Création des tables et migration en cours</Text>
        </Stack>
      </Center>
    );
  }

  if (!dbReady) {
    return (
      <Center style={{ height: '100vh' }}>
        <Stack align="center" gap="md">
          <Notification title="Erreur Base de données" color="red">
            Impossible d'initialiser la base de données.
            <Button onClick={() => window.location.reload()} size="xs" mt="md">
              Réessayer
            </Button>
          </Notification>
        </Stack>
      </Center>
    );
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