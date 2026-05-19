// src/components/auth/Register.tsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, TextInput, PasswordInput, Button, Stack, Title, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Role } from '../../types/auth';

export const Register: React.FC = () => {
  const [nom, setNom] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('commercial');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      notifications.show({
        title: 'Erreur',
        message: 'Les mots de passe ne correspondent pas',
        color: 'red',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      await register(nom, login, password, role);
      notifications.show({
        title: 'Succès',
        message: 'Utilisateur créé avec succès',
        color: 'green',
      });
      
      // Réinitialiser le formulaire
      setNom('');
      setLogin('');
      setPassword('');
      setConfirmPassword('');
      
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de la création',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder shadow="lg" padding="xl" radius="md">
      <Title order={3} mb="lg">Créer un utilisateur</Title>
      
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Nom complet"
            placeholder="Entrez le nom complet"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
          
          <TextInput
            label="Login"
            placeholder="Entrez le login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
          />
          
          <PasswordInput
            label="Mot de passe"
            placeholder="Entrez le mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <PasswordInput
            label="Confirmer le mot de passe"
            placeholder="Confirmez le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          
          <Select
            label="Rôle"
            value={role}
            onChange={(value) => setRole(value as Role)}
            data={[
              { value: 'admin', label: 'Administrateur' },
              { value: 'gestionnaire', label: 'Gestionnaire' },
              { value: 'commercial', label: 'Commercial' },
              { value: 'stockiste', label: 'Stockiste' },
              { value: 'comptable', label: 'Comptable' },
            ]}
            required
          />
          
          <Button type="submit" loading={loading} fullWidth>
            Créer l'utilisateur
          </Button>
        </Stack>
      </form>
    </Card>
  );
};