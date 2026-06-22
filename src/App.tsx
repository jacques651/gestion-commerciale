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
import { DatabaseVersionManager } from './database/versionManager';
import { MigrationManagerComponent } from './components/MigrationManager';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
const DebugPanel = lazy(() => import('./components/debug/DebugPanel'));

// ==================== FACTURES DÉTAILS (imports directs car utilisés dans les routes) ====================
import DetailFacture from './components/factures/DetailFacture';
import DetailFactureRevendeur from './components/factures/DetailFactureRevendeur';
import ListeCommandes from './components/commandes/ListeCommandes';
import HistoriqueRevendeur from './components/pages/revendeurs/HistoriqueRevendeur';

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

// ✅ CORRECTION : Chemin correct pour HistoriqueRevendeur


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

// ✅ RouteGuard basé sur les permissions
function RouteGuard({
  children,
  requiredPermissions,
  requiredRoles,
  redirectTo = '/'
}: {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  redirectTo?: string;
}) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return <Login />;

  if (!user) {
    return <Login />;
  }

  // Vérifier les rôles
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      return (
        <Center style={{ height: '50vh' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>⛔ Accès non autorisé</h2>
            <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
            <Button onClick={() => navigate(redirectTo)} mt="md">Retour</Button>
          </div>
        </Center>
      );
    }
  }

  // Vérifier les permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    // Si l'utilisateur est admin, il a tous les droits
    if (user.role === 'admin') {
      return <>{children}</>;
    }

    // Récupérer les permissions de l'utilisateur
    let userPermissions: Record<string, boolean> = {};
    try {
      // @ts-ignore - user.permissions est ajouté dynamiquement
      userPermissions = user.permissions ? JSON.parse(user.permissions) : {};
    } catch (e) {
      console.error('Erreur parsing permissions:', e);
    }

    // Vérifier chaque permission requise
    const hasAllPermissions = requiredPermissions.every(perm => userPermissions[perm] === true);

    if (!hasAllPermissions) {
      return (
        <Center style={{ height: '50vh' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>⛔ Accès non autorisé</h2>
            <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
            <Button onClick={() => navigate(redirectTo)} mt="md">Retour</Button>
          </div>
        </Center>
      );
    }
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
              <RouteGuard requiredPermissions={['dashboard.view']}>
                <Dashboard setPage={handleSetPage} />
              </RouteGuard>
            } />

            {/* GESTION COMMERCIALE - CLIENTS */}
            <Route path="/clients" element={
              <RouteGuard requiredPermissions={['clients.view']}>
                <ListeClients />
              </RouteGuard>
            } />

            {/* COMMANDES */}
            <Route path="/commandes" element={
              <RouteGuard requiredPermissions={['commandes.view']}>
                <ListeCommandes />
              </RouteGuard>
            } />
            <Route path="/commandes/standard" element={
              <RouteGuard requiredPermissions={['commandes.view']}>
                <ListeCommandeStandard />
              </RouteGuard>
            } />
            <Route path="/commandes/revendeur" element={
              <RouteGuard requiredPermissions={['revendeurs.commandes']}>
                <ListeCommandesRevendeur />
              </RouteGuard>
            } />
            <Route path="/commandes/nouveau" element={
              <RouteGuard requiredPermissions={['commandes.create']}>
                <FormulaireCommande opened={true} onClose={() => { }} />
              </RouteGuard>
            } />

            {/* FACTURES */}
            <Route path="/factures" element={
              <RouteGuard requiredPermissions={['factures.view']}>
                <ListeFactures />
              </RouteGuard>
            } />
            <Route path="/factures-revendeur" element={
              <RouteGuard requiredPermissions={['revendeurs.factures']}>
                <ListeFacturesRevendeur />
              </RouteGuard>
            } />

            {/* DÉTAILS FACTURES */}
            <Route path="/factures/:id" element={
              <RouteGuard requiredPermissions={['factures.view']}>
                <DetailFacture />
              </RouteGuard>
            } />
            <Route path="/factures-revendeur/:id" element={
              <RouteGuard requiredPermissions={['revendeurs.factures']}>
                <DetailFactureRevendeur />
              </RouteGuard>
            } />

            {/* VENTES */}
            <Route path="/ventes" element={
              <RouteGuard requiredPermissions={['ventes.view']}>
                <ListeVentes />
              </RouteGuard>
            } />

            {/* REVENDEURS */}
            <Route path="/dashboard-revendeurs" element={
              <RouteGuard requiredPermissions={['revendeurs.view']}>
                <DashboardRevendeurs />
              </RouteGuard>
            } />
            <Route path="/stock-revendeurs" element={
              <RouteGuard requiredPermissions={['revendeurs.stock']}>
                <ListeStockRevendeur />
              </RouteGuard>
            } />
            
            {/* ✅ Route pour l'historique - CORRECTE */}
            <Route path="/revendeurs/historique" element={
              <RouteGuard requiredPermissions={['revendeurs.view']}>
                <HistoriqueRevendeur />
              </RouteGuard>
            } />

            {/* PRODUITS & STOCK */}
            <Route path="/products" element={
              <RouteGuard requiredPermissions={['products.view']}>
                <ListeProduits />
              </RouteGuard>
            } />

            {/* FINANCES */}
            <Route path="/decomptes" element={
              <RouteGuard requiredPermissions={['revendeurs.decomptes']}>
                <ListeDecomptes />
              </RouteGuard>
            } />
            <Route path="/decomptes/nouveau" element={
              <RouteGuard requiredPermissions={['revendeurs.decomptes']}>
                <NouveauDecompteWrapper />
              </RouteGuard>
            } />
            <Route path="/decomptes/:id" element={
              <RouteGuard requiredPermissions={['revendeurs.decomptes']}>
                <DetailDecompte />
              </RouteGuard>
            } />
            <Route path="/decomptes/:id/print" element={
              <RouteGuard requiredPermissions={['revendeurs.decomptes']}>
                <PrintRecuDecompte />
              </RouteGuard>
            } />
            <Route path="/reglements" element={
              <RouteGuard requiredPermissions={['finances.reglements']}>
                <ListeReglements />
              </RouteGuard>
            } />

            {/* CAISSE */}
            <Route path="/caisse" element={
              <RouteGuard requiredPermissions={['caisse.view']}>
                <JournalCaisse />
              </RouteGuard>
            } />
            <Route path="/charges" element={
              <RouteGuard requiredPermissions={['caisse.charges']}>
                <ChargesFonctionnement />
              </RouteGuard>
            } />

            {/* CRÉDITS */}
            <Route path="/credits" element={
              <RouteGuard requiredPermissions={['finances.credits']}>
                <ListeCredits />
              </RouteGuard>
            } />
            <Route path="/remboursements" element={
              <RouteGuard requiredPermissions={['finances.remboursements']}>
                <RemboursementsList />
              </RouteGuard>
            } />

            {/* PARAMÈTRES */}
            <Route path="/utilisateurs" element={
              <RouteGuard requiredPermissions={['admin.users']}>
                <ListeUtilisateurs />
              </RouteGuard>
            } />
            <Route path="/parametres" element={
              <RouteGuard requiredPermissions={['admin.parametres']}>
                <ParametresAtelier />
              </RouteGuard>
            } />
            <Route path="/diagnostic" element={
              <RouteGuard requiredPermissions={['admin.diagnostic']}>
                <DiagnosticDB />
              </RouteGuard>
            } />
            <Route path="/debug" element={
              <RouteGuard requiredPermissions={['admin.diagnostic']}>
                <DebugPanel />
              </RouteGuard>
            } />

            {/* ✅ Route pour les commandes revendeur (ajoutée) */}
            <Route path="/commandes-revendeur" element={
              <RouteGuard requiredPermissions={['revendeurs.commandes']}>
                <ListeCommandesRevendeur />
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
  const [showMigration, setShowMigration] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    const setup = async () => {
      try {
        console.log('🚀 Démarrage de l\'application...');

        // 🔥 Exécuter la migration complète avec le schéma
        await initDatabaseWithMigrations();

        // Vérifier si une migration est nécessaire
        try {
          const versionInfo = await DatabaseVersionManager.getCurrentVersion();
          const currentVersion = DatabaseVersionManager.getCurrentVersionNumber();

          console.log(`📊 Version DB: ${versionInfo.version} (dernière: ${currentVersion})`);

          if (versionInfo.version < currentVersion) {
            console.log('🔄 Migration nécessaire !');
            setShowMigration(true);
          } else {
            console.log('✅ Base de données à jour');
            setAppReady(true);
          }
        } catch (versionError) {
          console.warn('⚠️ Impossible de vérifier la version, continuation...');
          setAppReady(true);
        }

        console.log('✅ Base de données initialisée avec succès');
        setDbReady(true);
      } catch (error: any) {
        const errorMsg = error?.message || 'Erreur inconnue';
        console.error('❌ Erreur DB fatale:', errorMsg);
        setDbError(errorMsg);
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
      <MantineProvider>
        <Center style={{ height: '100vh' }}>
          <Stack align="center" gap="md">
            <Loader size="xl" variant="dots" />
            <Text size="lg" fw={600}>Initialisation de la base de données...</Text>
            <Text size="sm" c="dimmed">Création des tables et migration en cours</Text>
          </Stack>
        </Center>
      </MantineProvider>
    );
  }

  // Afficher le gestionnaire de migration si nécessaire
  if (showMigration) {
    return (
      <MantineProvider>
        <Notifications position="top-right" />
        <MigrationManagerComponent
          onComplete={() => {
            setShowMigration(false);
            setAppReady(true);
            // Recharger la page pour appliquer les changements
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }}
        />
      </MantineProvider>
    );
  }

  // Erreur de base de données
  if (!dbReady || dbError) {
    return (
      <MantineProvider>
        <Center style={{ height: '100vh' }}>
          <Stack align="center" gap="md">
            <Notification title="Erreur Base de données" color="red">
              {dbError || 'Impossible d\'initialiser la base de données.'}
              <Button onClick={() => window.location.reload()} size="xs" mt="md">
                Réessayer
              </Button>
            </Notification>
          </Stack>
        </Center>
      </MantineProvider>
    );
  }

  // L'application est prête
  if (!appReady) {
    return (
      <MantineProvider>
        <Center style={{ height: '100vh' }}>
          <Loader size="xl" />
          <Text mt="md" c="dimmed">Préparation de l'application...</Text>
        </Center>
      </MantineProvider>
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