// src/components/auth/Login.tsx
import React, { useState, useEffect } from "react";
import {
  Stack,
  Text,
  Button,
  TextInput,
  PasswordInput,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconLogin,
  IconUserPlus,
  IconUser,
  IconLock,
  IconUserCircle,
  IconAlertCircle,
} from '@tabler/icons-react';
import { Store, ShoppingCart, Warehouse, Banknote } from 'lucide-react';
import { getDb } from "../../database/db";
import { useAuth } from "../../contexts/AuthContext";

const Login: React.FC = () => {
  const { login } = useAuth();

  const [isFirstUser, setIsFirstUser] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [nom, setNom] = useState("");
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const checkUserTable = async () => {
      try {
        const db = await getDb();

        const tables = await db.select<any[]>(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='users'
        `);

        if (tables.length === 0) {
          await db.execute(`
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              nom TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              mot_de_passe TEXT NOT NULL,
              role TEXT DEFAULT 'utilisateur',
              telephone TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          setIsFirstUser(true);
          return;
        }

        const result = await db.select<any[]>("SELECT id FROM users LIMIT 1");
        setIsFirstUser(result.length === 0);

      } catch (err) {
        console.error("Erreur vérification utilisateurs:", err);
        setIsFirstUser(true);
      }
    };
    checkUserTable();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isFirstUser) {
        const db = await getDb();

        const tables = await db.select<any[]>(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='users'
        `);

        if (tables.length === 0) {
          await db.execute(`
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              nom TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              mot_de_passe TEXT NOT NULL,
              role TEXT DEFAULT 'utilisateur',
              telephone TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
        }

        await db.execute(
          `INSERT INTO users (nom, email, mot_de_passe, role, telephone)
           VALUES (?, ?, ?, ?, ?)`,
          [nom || 'Administrateur', loginValue, password, 'admin', '']
        );

        setIsFirstUser(false);
        setPassword("");
        setNom("");
        setLoginValue("");

        const success = await login(loginValue, password);
        if (!success) setError("Erreur lors de la connexion automatique. Veuillez vous reconnecter.");

      } else {
        const success = await login(loginValue, password);
        if (!success) setError("Identifiants incorrects. Veuillez réessayer.");
      }
    } catch (err: any) {
      console.error("Erreur:", err);
      setError("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Voulez-vous vraiment supprimer tous les utilisateurs ?")) return;

    try {
      const db = await getDb();
      await db.execute("DELETE FROM users");
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const points = [
    { icon: ShoppingCart, text: 'Commandes, ventes et factures clients et revendeurs' },
    { icon: Warehouse, text: 'Suivi du stock, des décomptes et des réapprovisionnements' },
    { icon: Banknote, text: 'Caisse, règlements et crédits en temps réel' },
  ];

  const brandPanel = (
    <aside className="tk-login-side">
      <div className="tk-login-crest"><Store size={34} /></div>
      <div className="tk-login-brand">GESTION PRO</div>
      <div className="tk-login-eyebrow">GESTION COMMERCIALE</div>
      <ul className="tk-login-points">
        {points.map(({ icon: Icon, text }, i) => (
          <li key={text} className="tk-login-point" data-active={i === 0 || undefined}>
            <span className="tk-login-point-icon"><Icon size={18} /></span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );

  if (isFirstUser === null) {
    return (
      <div className="tk-login">
        <div className="tk-login-card">
          {brandPanel}
          <section className="tk-login-main" style={{ position: 'relative', minHeight: 320 }}>
            <LoadingOverlay visible={true} />
            <Text ta="center" className="tk-login-sub">Chargement...</Text>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="tk-login">
      <div className="tk-login-card">
        {brandPanel}

        <section className="tk-login-main">
          <div className="tk-login-logo">
            <Store size={20} />
            <span>GESTION PRO</span>
          </div>
          <div className="tk-login-rule" />

          <h1 className="tk-login-title">
            {isFirstUser ? "Configuration initiale" : "Connexion"}
          </h1>
          <Text className="tk-login-sub">
            {isFirstUser
              ? "Créez le compte administrateur pour démarrer"
              : "Entrez vos identifiants pour accéder à l'application"}
          </Text>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mt="md" radius="md" className="tk-login-alert">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="tk-login-form">
            <Stack gap="md">
              {isFirstUser && (
                <TextInput
                  label="Nom complet"
                  placeholder="Votre nom et prénom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  leftSection={<IconUser size={16} />}
                  size="md"
                  radius="md"
                  required
                />
              )}

              <TextInput
                label="Identifiant"
                placeholder={isFirstUser ? "ex: admin" : "Votre identifiant"}
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                leftSection={<IconUserCircle size={16} />}
                size="md"
                radius="md"
                required
                autoComplete="username"
              />

              <PasswordInput
                label="Mot de passe"
                placeholder={isFirstUser ? "Choisissez un mot de passe" : "Votre mot de passe"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftSection={<IconLock size={16} />}
                size="md"
                radius="md"
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                loading={loading}
                size="md"
                fullWidth
                radius="md"
                leftSection={isFirstUser ? <IconUserPlus size={18} /> : <IconLogin size={18} />}
                style={{ marginTop: 4 }}
              >
                {isFirstUser ? "Créer le compte administrateur" : "Se connecter"}
              </Button>
            </Stack>
          </form>

          {!isFirstUser && (
            <button type="button" className="tk-login-link" onClick={handleReset}>
              Réinitialiser les utilisateurs
            </button>
          )}

          <div className="tk-login-version">Gestion Pro v1.0</div>
        </section>
      </div>

      <LoadingOverlay visible={loading} />
    </div>
  );
};

export default Login;
