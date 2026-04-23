// src/App.tsx
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, BrowserRouter, useNavigate } from 'react-router-dom';
import { AppShell, Loader, Center, MantineProvider, Button } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import Navbar from './components/common/Navbar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Database from '@tauri-apps/plugin-sql';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// ==================== AUTH ====================
const Login = lazy(() => import('./components/auth/Login'));

// ==================== DASHBOARD ====================
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));

// ==================== GESTION COMMERCIALE ====================
const ListeClients = lazy(() => import('./components/clients/ListeClients'));
const ListeCommandes = lazy(() => import('./components/commandes/ListeCommandes'));
const ListeFactures = lazy(() => import('./components/factures/ListeFactures'));
const ListeVentes = lazy(() => import('./components/ventes/ListeVentes'));

// ==================== PRODUITS & STOCK ====================
const ListeProduits = lazy(() => import('./components/products/ListeProduits'));
const StockGlobal = lazy(() => import('./components/stock/StockGlobal'));

// ==================== FINANCES ====================
const ListeDecomptes = lazy(() => import('./components/decomptes/ListeDecomptes'));
const ListeReglements = lazy(() => import('./components/reglements/ListeReglements'));

// ==================== PARAMÈTRES ====================
const ListeUtilisateurs = lazy(() => import('./components/utilisateurs/ListeUtilisateurs'));
const ParametresAtelier = lazy(() => import('./components/parametres/ParametresAtelier'));

// ==================== TYPES ====================
type PageKey = 
  | 'dashboard' | 'clients' | 'commandes' | 'factures' | 'ventes'
  | 'products' | 'stock' | 'decomptes' | 'reglements'
  | 'utilisateurs' | 'parametres';

// ==================== COMPOSANTS ====================
const LoadingFallback = () => (
  <Center style={{ height: '100vh' }}>
    <Loader size="xl" variant="dots" />
  </Center>
);

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

// ==================== APP AUTHENTIFIÉE ====================
function AuthenticatedApp() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const initSqlite = async () => {
      try {
        const db = await Database.load("sqlite:gestion-commerciale.db");
        
        // Table clients
        await db.execute(`
          CREATE TABLE IF NOT EXISTS clients (
            idClient INTEGER PRIMARY KEY AUTOINCREMENT,
            code_client TEXT UNIQUE NOT NULL,
            nom_complet TEXT NOT NULL,
            societe TEXT,
            type_client TEXT DEFAULT 'PARTICULIER',
            adresse TEXT,
            ville TEXT,
            telephone TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            est_actif INTEGER DEFAULT 1,
            est_supprime INTEGER DEFAULT 0
          )
        `);

        // Table produits
        await db.execute(`
          CREATE TABLE IF NOT EXISTS products (
            idProduit INTEGER PRIMARY KEY AUTOINCREMENT,
            code_produit TEXT UNIQUE NOT NULL,
            categorie TEXT NOT NULL,
            designation TEXT NOT NULL,
            unite_base TEXT DEFAULT 'pièce',
            prix_achat_base REAL DEFAULT 0,
            prix_vente_detail REAL DEFAULT 0,
            prix_vente_gros REAL DEFAULT 0,
            seuil_alerte REAL DEFAULT 0,
            date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
            est_supprime INTEGER DEFAULT 0
          )
        `);

        // Table commandes
        await db.execute(`
          CREATE TABLE IF NOT EXISTS commandes (
            idCommande INTEGER PRIMARY KEY AUTOINCREMENT,
            code_commande TEXT UNIQUE NOT NULL,
            idClient INTEGER NOT NULL,
            type_commande TEXT DEFAULT 'SIMPLE',
            date_commande DATETIME DEFAULT CURRENT_TIMESTAMP,
            objet TEXT,
            montant_ht REAL DEFAULT 0,
            montant_ttc REAL DEFAULT 0,
            statut TEXT DEFAULT 'CONFIRMEE',
            FOREIGN KEY (idClient) REFERENCES clients(idClient)
          )
        `);

        // Table factures
        await db.execute(`
          CREATE TABLE IF NOT EXISTS factures (
            idFacture INTEGER PRIMARY KEY AUTOINCREMENT,
            code_facture TEXT UNIQUE NOT NULL,
            idCommande INTEGER NOT NULL,
            date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
            montant_ht REAL NOT NULL,
            montant_ttc REAL NOT NULL,
            statut TEXT DEFAULT 'EN_ATTENTE',
            FOREIGN KEY (idCommande) REFERENCES commandes(idCommande)
          )
        `);

        // Table ventes
        await db.execute(`
          CREATE TABLE IF NOT EXISTS ventes (
            idVente INTEGER PRIMARY KEY AUTOINCREMENT,
            code_vente TEXT UNIQUE NOT NULL,
            idClient INTEGER,
            nom_prenom TEXT NOT NULL,
            contact TEXT,
            date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
            montant_total REAL DEFAULT 0,
            type_vente TEXT DEFAULT 'COMPTOIR',
            observation TEXT,
            FOREIGN KEY (idClient) REFERENCES clients(idClient)
          )
        `);

        // Table reglements
        await db.execute(`
          CREATE TABLE IF NOT EXISTS reglements (
            idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
            code_reglement TEXT UNIQUE NOT NULL,
            idClient INTEGER,
            idFacture INTEGER,
            date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
            montant_regle REAL NOT NULL,
            mode_reglement TEXT,
            reference TEXT,
            observation TEXT,
            FOREIGN KEY (idClient) REFERENCES clients(idClient),
            FOREIGN KEY (idFacture) REFERENCES factures(idFacture)
          )
        `);

        // Table utilisateurs
        await db.execute(`
          CREATE TABLE IF NOT EXISTS utilisateurs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            login TEXT NOT NULL UNIQUE,
            mot_de_passe_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'commercial',
            est_actif INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        console.log("✅ SQLite Initialisé");
      } catch (error) {
        console.error("❌ Erreur SQLite:", error);
      }
    };
    initSqlite();
  }, []);

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
    };
    navigate(routeMap[page] || '/');
  };

  if (loading) return <LoadingFallback />;
  if (!isAuthenticated) return <Login />;

  return (
    <AppShell padding="md" navbar={{ width: 260, breakpoint: 'sm' }} styles={{ main: { height: '100%', overflow: 'auto', backgroundColor: '#f5f7fa' } }}>
      <AppShell.Navbar>
        <Navbar userRole={user?.role} userName={user?.nom} onLogout={handleLogout} />
      </AppShell.Navbar>
      <AppShell.Main>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* DASHBOARD */}
            <Route path="/" element={<RouteGuard roles={['admin', 'gestionnaire']}><Dashboard setPage={handleSetPage} /></RouteGuard>} />

            {/* GESTION COMMERCIALE */}
            <Route path="/clients" element={<RouteGuard roles={['admin', 'gestionnaire']}><ListeClients /></RouteGuard>} />
            <Route path="/commandes" element={<RouteGuard roles={['admin', 'gestionnaire']}><ListeCommandes /></RouteGuard>} />
            <Route path="/factures" element={<RouteGuard roles={['admin', 'gestionnaire']}><ListeFactures /></RouteGuard>} />
            <Route path="/ventes" element={<RouteGuard roles={['admin', 'gestionnaire']}><ListeVentes /></RouteGuard>} />

            {/* PRODUITS & STOCK */}
            <Route path="/products" element={<RouteGuard roles={['admin', 'gestionnaire']}><ListeProduits /></RouteGuard>} />
            <Route path="/stock" element={<RouteGuard roles={['admin', 'gestionnaire']}><StockGlobal /></RouteGuard>} />

            {/* FINANCES */}
            <Route path="/decomptes" element={<RouteGuard roles={['admin']}><ListeDecomptes /></RouteGuard>} />
            <Route path="/reglements" element={<RouteGuard roles={['admin', 'gestionnaire']}><ListeReglements /></RouteGuard>} />

            {/* PARAMÈTRES */}
            <Route path="/utilisateurs" element={<RouteGuard roles={['admin']}><ListeUtilisateurs /></RouteGuard>} />
            <Route path="/parametres" element={<RouteGuard roles={['admin']}><ParametresAtelier /></RouteGuard>} />

            {/* 404 */}
            <Route path="*" element={<Center style={{ height: '50vh' }}><div style={{ textAlign: 'center' }}><h2>🔍 404 - Page non trouvée</h2><p>La page que vous recherchez n'existe pas.</p><Button onClick={() => navigate('/')} mt="md">Retour au Dashboard</Button></div></Center>} />
          </Routes>
        </Suspense>
      </AppShell.Main>
    </AppShell>
  );
}

// ==================== QUERY CLIENT ====================
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1, refetchOnWindowFocus: false } },
});

// ==================== APP PRINCIPALE ====================
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-right" zIndex={1000} />
        <BrowserRouter>
          <AuthProvider>
            <AuthenticatedApp />
          </AuthProvider>
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default App;