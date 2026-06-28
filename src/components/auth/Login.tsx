// src/components/auth/Login.tsx
import React, { useState, useEffect } from "react";
import {
  Stack,
  Card,
  Title,
  Text,
  Button,
  TextInput,
  PasswordInput,
  Alert,
  Box,
  LoadingOverlay,
  ThemeIcon,
  Center,
  Divider,
} from '@mantine/core';
import {
  IconLogin,
  IconUserPlus,
  IconUser,
  IconLock,
  IconUserCircle,
  IconAlertCircle,
  IconBuildingStore,
} from '@tabler/icons-react';
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

  if (isFirstUser === null) {
    return (
      <Box style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1628 0%, #122040 50%, #1b365d 100%)',
      }}>
        <Card withBorder radius="xl" p="xl" pos="relative" style={{ minWidth: 340 }}>
          <LoadingOverlay visible={true} />
          <Text ta="center" c="dimmed">Chargement...</Text>
        </Card>
      </Box>
    );
  }

  return (
    <Box style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a1628 0%, #122040 50%, #1b365d 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Cercles décoratifs en arrière-plan */}
      <Box style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)',
        top: -100,
        right: -100,
        pointerEvents: 'none',
      }} />
      <Box style={{
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)',
        bottom: -50,
        left: -50,
        pointerEvents: 'none',
      }} />

      <Box style={{ maxWidth: 420, width: '100%', margin: '0 auto', padding: '0 16px', position: 'relative', zIndex: 1 }}>
        {/* Logo + titre au-dessus de la carte */}
        <Center mb="xl">
          <Stack align="center" gap="xs">
            <ThemeIcon
              size={64}
              radius="xl"
              variant="gradient"
              gradient={{ from: '#1b365d', to: '#2563eb' }}
              style={{
                boxShadow: '0 8px 32px rgba(37,99,235,0.4)',
                border: '2px solid rgba(255,255,255,0.15)',
              }}
            >
              <IconBuildingStore size={32} />
            </ThemeIcon>
            <Text fw={800} size="xl" c="white" ta="center" style={{ letterSpacing: -0.5 }}>
              Gestion Commerciale
            </Text>
            <Text size="xs" c="rgba(255,255,255,0.45)" ta="center">
              Système de gestion intégré
            </Text>
          </Stack>
        </Center>

        {/* Carte de connexion */}
        <Card
          radius="xl"
          p="xl"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}
        >
          <Stack gap="xs" mb="lg">
            <Title order={3} c="#0a1628" fw={700}>
              {isFirstUser ? "Configuration initiale" : "Connexion"}
            </Title>
            <Text size="sm" c="dimmed">
              {isFirstUser
                ? "Créez le compte administrateur pour démarrer"
                : "Entrez vos identifiants pour accéder à l'application"}
            </Text>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" radius="md">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
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
                variant="gradient"
                gradient={{ from: '#0a1628', to: '#2563eb' }}
                leftSection={isFirstUser ? <IconUserPlus size={18} /> : <IconLogin size={18} />}
                style={{ marginTop: 4, boxShadow: '0 4px 16px rgba(37,99,235,0.35)' }}
              >
                {isFirstUser ? "Créer le compte administrateur" : "Se connecter"}
              </Button>
            </Stack>
          </form>

          {!isFirstUser && (
            <>
              <Divider my="md" label="Options" labelPosition="center" />
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                fullWidth
                onClick={handleReset}
              >
                Réinitialiser les utilisateurs
              </Button>
            </>
          )}
        </Card>
      </Box>

      <LoadingOverlay visible={loading} />
    </Box>
  );
};

export default Login;
