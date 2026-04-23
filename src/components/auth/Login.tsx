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
  const { login, register } = useAuth();

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
        const result = await db.select<any[]>("SELECT id FROM utilisateurs LIMIT 1");
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
        await register(nom, loginValue, password, 'admin');
        alert("Administrateur créé ! Connectez-vous maintenant.");
        setIsFirstUser(false);
        setPassword("");
        setNom("");
        setLoginValue("");
      } else {
        const success = await login(loginValue, password);
        if (!success) setError("Identifiants incorrects.");
      }
    } catch (err: any) {
      setError("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const db = await getDb();
    await db.execute("DELETE FROM utilisateurs");
    alert("Base vidée, redémarrez l'application");
    window.location.reload();
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
              {isFirstUser ? "Créez le compte administrateur pour commencer" : "Connectez-vous à votre compte"}
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
                placeholder="Nom d'utilisateur"
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                leftSection={<IconUserCircle size={16} />}
                size="md"
                required
              />

              <PasswordInput
                label="Mot de passe"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftSection={<IconLock size={16} />}
                size="md"
                required
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

              <Button
                variant="subtle"
                size="xs"
                fullWidth
                onClick={handleReset}
              >
                🛠️ Réinitialiser (admin)
              </Button>
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