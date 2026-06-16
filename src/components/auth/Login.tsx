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
  Divider,
  Alert,
  Box,
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
        
        // Vérifier si la table users existe
        const tables = await db.select<any[]>(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='users'
        `);
        
        if (tables.length === 0) {
          console.log("🔧 Table users inexistante, création...");
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
          console.log("✅ Table users créée");
          setIsFirstUser(true);
          return;
        }
        
        // Vérifier s'il y a des utilisateurs
        const result = await db.select<any[]>("SELECT id FROM users LIMIT 1");
        console.log("Nombre d'utilisateurs:", result.length);
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
        // Créer le premier utilisateur (admin)
        const db = await getDb();
        
        // Vérifier si la table existe
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
        
        // Insérer l'admin
        await db.execute(
          `INSERT INTO users (nom, email, mot_de_passe, role, telephone) 
           VALUES (?, ?, ?, ?, ?)`,
          [nom || 'Administrateur', loginValue, password, 'admin', '']
        );
        
        alert("✅ Administrateur créé avec succès !\n\nIdentifiants:\n👤 " + loginValue + "\n🔑 " + password);
        setIsFirstUser(false);
        setPassword("");
        setNom("");
        setLoginValue("");
        
        // Reconnecter automatiquement
        const success = await login(loginValue, password);
        if (!success) setError("Erreur lors de la connexion automatique. Veuillez vous reconnecter.");
        
      } else {
        // Connexion normale
        const success = await login(loginValue, password);
        if (!success) setError("Identifiants incorrects.");
      }
    } catch (err: any) {
      console.error("Erreur:", err);
      setError("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("⚠️ Voulez-vous vraiment supprimer tous les utilisateurs ?")) return;
    
    try {
      const db = await getDb();
      await db.execute("DELETE FROM users");
      alert("✅ Base vidée. L'application va redémarrer.");
      window.location.reload();
    } catch (err) {
      alert("❌ Erreur lors de la réinitialisation");
      console.error(err);
    }
  };

  if (isFirstUser === null) {
    return (
      <Box style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card withBorder radius="md" p="lg" pos="relative">
          <LoadingOverlay visible={true} />
          <Text>Chargement...</Text>
        </Card>
      </Box>
    );
  }

  return (
    <Box style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa' }}>
      <Box style={{ maxWidth: 450, width: '100%', margin: '0 auto' }} p="md">
        <Card withBorder radius="md" shadow="lg" p="xl">
          <Stack align="center" mb="xl">
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#1b365d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isFirstUser ? <IconUserPlus size={32} color="white" /> : <IconLogin size={32} color="white" />}
            </div>
            <Title order={2} ta="center" c="#1b365d">
              {isFirstUser ? "Configuration Initiale" : "Connexion"}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {isFirstUser 
                ? "Créez le compte administrateur pour commencer" 
                : "Connectez-vous à votre compte"}
            </Text>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
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
                  required
                />
              )}

              <TextInput
                label="Identifiant"
                placeholder={isFirstUser ? "Nom d'utilisateur (ex: admin)" : "Nom d'utilisateur"}
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                leftSection={<IconUserCircle size={16} />}
                size="md"
                required
                autoComplete="username"
              />

              <PasswordInput
                label="Mot de passe"
                placeholder={isFirstUser ? "Choisissez un mot de passe fort" : "Votre mot de passe"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftSection={<IconLock size={16} />}
                size="md"
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                loading={loading}
                size="md"
                fullWidth
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                leftSection={isFirstUser ? <IconUserPlus size={18} /> : <IconLogin size={18} />}
              >
                {loading ? "Traitement..." : (isFirstUser ? "Créer l'administrateur" : "Se connecter")}
              </Button>

              {!isFirstUser && (
                <Button
                  variant="subtle"
                  size="xs"
                  fullWidth
                  onClick={handleReset}
                  color="red"
                >
                  🛠️ Réinitialiser (admin)
                </Button>
              )}
            </Stack>
          </form>

          <Divider my="lg" />
          <Text size="xs" c="dimmed" ta="center">© 2026 Gestion Commerciale</Text>
        </Card>
      </Box>
    </Box>
  );
};

export default Login;