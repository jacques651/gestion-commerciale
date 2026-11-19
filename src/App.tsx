// src/App.tsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { AppShell, Loader, Center, Button, Notification, MantineProvider, Stack, Text, Burger, Group } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Notifications } from '@mantine/notifications';
import Navbar from './components/common/Navbar';
import TopBar from './components/common/TopBar';
import PageBanner from './components/common/PageBanner';
import BandeauRestauration from './components/common/BandeauRestauration';
import { useGlobalModalDrag } from './hooks/useDraggable';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { theme } from './theme';
import { colorSchemeManager, defaultColorScheme } from './theme/themeScheme';
import { runSchemaMigration } from './database/runMigration';
import { initDatabase } from './database/db'; // ✅ AJOUTÉ
import { confirm } from './utils/confirm';
import { DatabaseVersionManager } from './database/versionManager';
import { sessionCaisseService } from './services/sessionCaisseService';
import { licenceService, LicenceStatus } from './services/licenceService';
import { EcranExpiration } from './components/EcranExpiration';
import { ModalActivationLicence } from './components/ModalActivationLicence';
const DebugPanel = lazy(() => import('./components/debug/DebugPanel'));

// ==================== FACTURES DÉTAILS ====================
import DetailFacture from './components/factures/DetailFacture';
import DetailFactureRevendeur from './components/factures/DetailFactureRevendeur';
import HistoriqueRevendeur from './components/pages/revendeurs/HistoriqueRevendeur';
import ListeCommandes from './components/commandes/ListeCommandes';
import { GestionRevendeursPonctuels } from './components/pages/revendeurs/ponctuels/GestionRevendeursPonctuels';
import SecondeMain from './components/pages/SecondeMain';

// ==================== AUTH ====================
const Login = lazy(() => import('./components/auth/Login'));

// ==================== DASHBOARD ====================
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const HistoriqueActivite = lazy(() => import('./components/historique/HistoriqueActivite'));
const GuideCircuits = lazy(() => import('./components/guide/GuideCircuits'));

// ==================== GESTION COMMERCIALE ====================
const ListeClients = lazy(() => import('./components/clients/ListeClients'));
const ListeFactures = lazy(() => import('./components/factures/ListeFactures'));
const ListeVentes = lazy(() => import('./components/ventes/ListeVentes'));
const FormulaireVente = lazy(() => import('./components/ventes/FormulaireVente'));
const GestionPrestations = lazy(() => import('./components/ventes/GestionPrestations'));

const ListeCommandeStandard = lazy(() => import('./components/commandes/ListeCommandeStandard'));
const ListeCommandesRevendeur = lazy(() => import('./components/commandes/ListeCommandesRevendeur'));
const FormulaireCommande = lazy(() => import('./components/commandes/FormulaireCommande'));
const FicheCommande = lazy(() => import('./components/commandes/FicheCommande'));

// ==================== REVENDEURS ====================
const ListeFacturesRevendeur = lazy(() => import('./components/factures/ListeFacturesRevendeur'));

// ==================== DECOMPTES ====================
const ListeDecomptes = lazy(() => import('./components/decomptes/ListeDecomptes'));
const DetailDecompte = lazy(() => import('./components/decomptes/DetailDecompte'));
const PrintRecuDecompte = lazy(() => import('./components/decomptes/PrintRecuDecompte'));
const NouveauDecompte = lazy(() => import('./components/decomptes/NouveauDecompte'));

// ==================== REVENDEURS (suite) ====================
const ListeStockRevendeur = lazy(() => import('./components/pages/revendeurs/ListeStockRevendeur'));
const DashboardRevendeurs = lazy(() => import('./components/pages/revendeurs/DashboardRevendeurs'));
const FicheRevendeur = lazy(() => import('./components/pages/revendeurs/FicheRevendeur'));
const AlertesRevendeurs = lazy(() => import('./components/pages/revendeurs/AlertesRevendeurs'));
const ControleCoherence = lazy(() => import('./components/pages/revendeurs/ControleCoherence'));


// ==================== PRODUITS & STOCK ====================
const ListeProduits = lazy(() => import('./components/products/ListeProduits'));

// ==================== FINANCES ====================
const ListeReglements = lazy(() => import('./components/reglements/ListeReglements'));
const TableauBordFinancier = lazy(() => import('./components/finances/TableauBordFinancier'));

// ==================== CAISSE ====================
const JournalCaisse = lazy(() => import('./components/caisse/JournalCaisse'));
const ChargesFonctionnement = lazy(() => import('./components/caisse/ChargesFonctionnement'));

// ==================== CRÉDITS ====================
const ListeCredits = lazy(() => import('./components/credits/ListeCredits'));
const RemboursementsList = lazy(() => import('./components/credits/RemboursementsList'));

// ==================== PARAMÈTRES ====================
const ListeUtilisateurs = lazy(() => import('./components/utilisateurs/ListeUtilisateurs'));
const ParametresAtelier = lazy(() => import('./components/parametres/ParametresAtelier'));
const GestionLicence = lazy(() => import('./components/parametres/GestionLicence'));
const DevDashboard = lazy(() => import('./components/parametres/DevDashboard'));
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
  | 'revendeurs-historique'
  | 'tableau-bord-financier';

// ==================== COMPOSANTS ====================
const LoadingFallback = () => (
  <Center style={{ height: '100vh' }}>
    <Loader size="xl" variant="dots" />
  </Center>
);

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
    if (user.role === 'admin') {
      return <>{children}</>;
    }

    let userPermissions: Record<string, boolean> = {};
    try {
      userPermissions = user.permissions ? JSON.parse(user.permissions) : {};
    } catch (e) {
      console.error('Erreur parsing permissions:', e);
    }

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

// ✅ Wrapper pour NouveauDecompte avec navigation et gestion de l'ID
function NouveauDecompteWrapper() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extraire l'ID de l'URL pour la modification
  const match = location.pathname.match(/\/decomptes\/(\d+)\/modifier/);
  const decompteId = match ? parseInt(match[1]) : undefined;

  // ✅ Récupérer les paramètres depuis l'état de navigation
  const { clientId, produitsPreSelectionnes } = location.state || {};

  return (
    <NouveauDecompte
      decompteId={decompteId}
      clientId={clientId}
      produitsPreSelectionnes={produitsPreSelectionnes}
      onSuccess={() => navigate('/decomptes')}
      onCancel={() => navigate('/decomptes')}
    />
  );
}

// ✅ Wrapper pour NouvelleVente
function NouvelleVenteWrapper() {
  const navigate = useNavigate();
  return (
    <FormulaireVente
      onSuccess={() => navigate('/ventes')}
      onCancel={() => navigate('/ventes')}
    />
  );
}

// ✅ Wrapper pour NouvelleCommande
function NouvelleCommandeWrapper() {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(true);

  const handleClose = () => {
    setOpened(false);
    navigate('/commandes');
  };

  return (
    <FormulaireCommande
      opened={opened}
      onClose={handleClose}
    />
  );
}

// ✅ Wrapper pour FicheCommande
function FicheCommandeWrapper() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extraire l'ID de l'URL
  const match = location.pathname.match(/\/commandes\/(\d+)/);
  const commandeId = match ? parseInt(match[1]) : undefined;

  const handleBack = () => {
    navigate('/commandes');
  };

  if (!commandeId) {
    return <Text>Commande non trouvée</Text>;
  }

  return <FicheCommande commandeId={commandeId} onBack={handleBack} />;
}

// ==================== APP AUTHENTIFIÉE ====================
function AuthenticatedApp({
  licenceStatus,
  onLicenceActivated
}: {
  licenceStatus?: LicenceStatus | null;
  onLicenceActivated?: () => void;
}) {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [navbarOpened, { toggle: toggleNavbar, close: closeNavbar }] = useDisclosure();
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('tk-nav-collapsed') === '1'; } catch { return false; }
  });
  const toggleNavCollapsed = () => setNavCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem('tk-nav-collapsed', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });
  // Sous 900 px : barre latérale remplacée par un bandeau horizontal en haut
  const isNarrow = useMediaQuery('(max-width: 900px)') ?? false;
  // Modales déplaçables par l'en-tête (délégation globale)
  useGlobalModalDrag();
  const [activationModalOpened, { open: openActivation, close: closeActivation }] = useDisclosure(false);

  const handleLogout = async () => {
    if (await confirm("Voulez-vous vous déconnecter ?", "Déconnexion")) {
      logout();
      navigate('/login');
    }
  };

  // Après une relève : le nouvel opérateur qui se connecte est amené
  // directement à la caisse, où son poste s'ouvre automatiquement.
  useEffect(() => {
    if (!isAuthenticated) return;
    let pending = false;
    try { pending = localStorage.getItem('gc_releve_pending') === '1'; } catch {}
    if (pending) navigate('/caisse');
    // Normalisation des anciennes factures si la TVA est désactivée
    // (montant_ttc = montant_ht) : évite d'afficher un TTC gonflé partout.
    import('./services/tvaService').then(m => m.tvaService.normaliserFacturesSiDesactivee()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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
      'revendeurs-historique': '/revendeurs/historique',
      'tableau-bord-financier': '/finances/tableau-de-bord'
    };
    navigate(routeMap[page] || '/');
  };

  if (loading) return <LoadingFallback />;
  if (!isAuthenticated) return <Login />;

  return (
    <AppShell
      padding="md"
      header={{ height: 56 }}
      navbar={{ width: navCollapsed ? 72 : 260, breakpoint: 0, collapsed: { desktop: isNarrow, mobile: isNarrow } }}
      styles={{
        main: {
          height: '100vh',
          overflowY: 'auto',
        },
      }}
    >
      <AppShell.Header>
        <TopBar userName={user?.nom} userRole={user?.role} onLogout={handleLogout} />
      </AppShell.Header>
      <AppShell.Navbar>
        <Navbar userRole={user?.role} onNavClose={closeNavbar} collapsed={navCollapsed} onToggleCollapse={toggleNavCollapsed} />
      </AppShell.Navbar>
      <AppShell.Main>
        {isNarrow && (
          <Navbar userRole={user?.role} onNavClose={closeNavbar} horizontal />
        )}
        {/* ── Bannière période d'essai + bouton activation ── */}
        {licenceStatus && licenceStatus.statut !== 'DEFINITIF' && (
          <div style={{
            background: licenceStatus.statut === 'EXPIRE'
              ? '#fff5f5'
              : licenceStatus.joursRestants <= 7 ? '#fff3cd' : '#e8f4fd',
            borderBottom: `1px solid ${licenceStatus.statut === 'EXPIRE'
              ? '#ffa8a8'
              : licenceStatus.joursRestants <= 7 ? '#ffc107' : '#74c0fc'}`,
            padding: '4px 16px',
            fontSize: 12,
            color: licenceStatus.statut === 'EXPIRE'
              ? '#c92a2a'
              : licenceStatus.joursRestants <= 7 ? '#856404' : '#1971c2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8
          }}>
            <span>
              {licenceStatus.statut === 'EXPIRE' ? '🔒' : licenceStatus.joursRestants <= 7 ? '⚠️' : 'ℹ️'}
              {' '}
              {licenceStatus.message}
            </span>
            <button
              onClick={openActivation}
              style={{
                background: licenceStatus.statut === 'EXPIRE' ? '#c92a2a' : licenceStatus.joursRestants <= 7 ? '#e67700' : '#1971c2',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '2px 10px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              Activer la version définitive
            </button>
          </div>
        )}

        {/* ── Modal d'activation ── */}
        <ModalActivationLicence
          opened={activationModalOpened}
          onClose={closeActivation}
          onActivated={() => { closeActivation(); onLicenceActivated?.(); }}
          licenceStatus={licenceStatus ?? null}
        />
        <PageBanner />
        <BandeauRestauration />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* DASHBOARD */}
            <Route path="/" element={
              <RouteGuard requiredPermissions={['dashboard.view']}>
                <Dashboard setPage={handleSetPage} />
              </RouteGuard>
            } />

            {/* HISTORIQUE GÉNÉRAL */}
            <Route path="/historique" element={
              <RouteGuard requiredPermissions={['dashboard.view']}>
                <HistoriqueActivite />
              </RouteGuard>
            } />

            {/* GUIDE DES CIRCUITS */}
            <Route path="/guide" element={
              <RouteGuard requiredPermissions={['dashboard.view']}>
                <GuideCircuits />
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
                <NouvelleCommandeWrapper />
              </RouteGuard>
            } />
            {/* ✅ Route pour voir les détails d'une commande */}
            <Route path="/commandes/:id" element={
              <RouteGuard requiredPermissions={['commandes.view']}>
                <FicheCommandeWrapper />
              </RouteGuard>
            } />
            {/* ✅ Route pour l'impression d'une commande */}
            <Route path="/commandes/:id/print" element={
              <RouteGuard requiredPermissions={['commandes.view']}>
                <FicheCommandeWrapper />
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
            <Route path="/ventes/nouvelle" element={
              <RouteGuard requiredPermissions={['ventes.create']}>
                <NouvelleVenteWrapper />
              </RouteGuard>
            } />
            <Route path="/prestations" element={
              <RouteGuard requiredPermissions={['ventes.create']}>
                <GestionPrestations />
              </RouteGuard>
            } />
            <Route path="/seconde-main" element={
              <RouteGuard requiredPermissions={['ventes.view']}>
                <SecondeMain />
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
            <Route path="/revendeurs/historique" element={
              <RouteGuard requiredPermissions={['revendeurs.view']}>
                <HistoriqueRevendeur />
              </RouteGuard>
            } />
            <Route path="/revendeurs/fiche" element={
              <RouteGuard requiredPermissions={['revendeurs.view']}>
                <FicheRevendeur />
              </RouteGuard>
            } />
            <Route path="/revendeurs/alertes" element={
              <RouteGuard requiredPermissions={['revendeurs.view']}>
                <AlertesRevendeurs />
              </RouteGuard>
            } />
            <Route path="/revendeurs/coherence" element={
              <RouteGuard requiredPermissions={['revendeurs.view']}>
                <ControleCoherence />
              </RouteGuard>
            } />

            {/* ✅ REVENDEURS PONCTUELS */}
            <Route path="/revendeurs/ponctuels" element={
              <RouteGuard requiredPermissions={['revendeurs.view']} requiredRoles={['admin']}>
                <GestionRevendeursPonctuels />
              </RouteGuard>
            } />

            {/* PRODUITS & STOCK */}
            <Route path="/products" element={
              <RouteGuard requiredPermissions={['products.view']}>
                <ListeProduits />
              </RouteGuard>
            } />

            {/* FINANCES - DECOMPTES */}
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
            <Route path="/decomptes/:id/reçu" element={
              <RouteGuard requiredPermissions={['revendeurs.decomptes']}>
                <PrintRecuDecompte />
              </RouteGuard>
            } />
            <Route path="/decomptes/:id/modifier" element={
              <RouteGuard requiredPermissions={['revendeurs.decomptes']}>
                <NouveauDecompteWrapper />
              </RouteGuard>
            } />
            <Route path="/reglements" element={
              <RouteGuard requiredPermissions={['finances.reglements']}>
                <ListeReglements />
              </RouteGuard>
            } />

            {/* TABLEAU DE BORD FINANCIER */}
            <Route path="/finances/tableau-de-bord" element={
              <RouteGuard requiredPermissions={['finances.reglements']}>
                <TableauBordFinancier />
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
            <Route path="/licence" element={
              <RouteGuard requiredPermissions={['admin.parametres']}>
                <GestionLicence />
              </RouteGuard>
            } />
            <Route path="/dev/licence" element={
              <RouteGuard requiredPermissions={['admin.parametres']}>
                <DevDashboard />
              </RouteGuard>
            } />
            <Route path="/debug" element={
              <RouteGuard requiredPermissions={['admin.diagnostic']}>
                <DebugPanel />
              </RouteGuard>
            } />

            {/* COMMANDES REVENDEUR */}
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
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ==================== APP ROOT ====================
function AppWithProviders() {
  const [licenceStatus, setLicenceStatus] = useState<LicenceStatus | null>(null);
  const [licenceLoaded, setLicenceLoaded] = useState(false);

  useEffect(() => {
    const checkLicence = async () => {
      try {
        // ✅ FORCER l'initialisation de la base avec le bon schéma
        console.log('🚀 Initialisation de la base de données avec le bon schéma...');
        await initDatabase();
        console.log('✅ Base initialisée avec le bon schéma');
        
        await runSchemaMigration();
        const status = await licenceService.verifierLicence();
        setLicenceStatus(status);
      } catch (error) {
        console.error('Erreur init:', error);
      } finally {
        setLicenceLoaded(true);
      }
    };
    checkLicence();
  }, []);

  if (!licenceLoaded) {
    return (
      <MantineProvider theme={theme} defaultColorScheme={defaultColorScheme} colorSchemeManager={colorSchemeManager}>
        <Center style={{ height: '100vh' }}>
          <Loader size="xl" variant="dots" />
        </Center>
      </MantineProvider>
    );
  }

  if (licenceStatus?.statut === 'EXPIRE') {
    return (
      <MantineProvider theme={theme} defaultColorScheme={defaultColorScheme} colorSchemeManager={colorSchemeManager}>
        <EcranExpiration
          status={licenceStatus}
          onActivated={() => {
            licenceService.verifierLicence().then(setLicenceStatus);
          }}
        />
      </MantineProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme={defaultColorScheme} colorSchemeManager={colorSchemeManager}>
        <Notifications position="top-right" zIndex={1000} />
        <AuthProvider>
          <BrowserRouter>
            <AuthenticatedApp
              licenceStatus={licenceStatus}
              onLicenceActivated={() => {
                licenceService.verifierLicence().then(setLicenceStatus);
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default AppWithProviders;
