// src/components/auth/Register.tsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, TextInput, PasswordInput, Button, Stack, Title, Select, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { Role } from '../../types/auth';
import { getDb } from '../../database/db';

export const Register: React.FC = () => {
  const [nom, setNom] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('commercial');
  const [telephone, setTelephone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Valider les champs
    if (!nom.trim()) {
      setError('Le nom complet est requis');
      return;
    }
    
    if (!login.trim()) {
      setError('Le login est requis');
      return;
    }
    
    if (password.length < 4) {
      setError('Le mot de passe doit contenir au moins 4 caractères');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    
    setLoading(true);
    
    try {
      // Vérifier si l'utilisateur existe déjà
      const db = await getDb();
      const existing = await db.select<any[]>(
        'SELECT id FROM users WHERE nom = ? OR email = ?',
        [nom, login]
      );
      
      if (existing && existing.length > 0) {
        throw new Error('Ce nom d\'utilisateur ou login existe déjà');
      }
      
      // Créer l'utilisateur
      await register(nom, login, password, role);
      
      notifications.show({
        title: '✅ Succès',
        message: `Utilisateur "${nom}" créé avec succès !`,
        color: 'green',
      });
      
      // Réinitialiser le formulaire
      setNom('');
      setLogin('');
      setPassword('');
      setConfirmPassword('');
      setTelephone('');
      setRole('commercial');
      
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la création de l\'utilisateur');
      notifications.show({
        title: '❌ Erreur',
        message: error.message || 'Erreur lors de la création',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const roleData = [
    { value: 'admin', label: '👑 Administrateur' },
    { value: 'gestionnaire', label: '📊 Gestionnaire' },
    { value: 'commercial', label: '💼 Commercial' },
    { value: 'stockiste', label: '📦 Stockiste' },
    { value: 'comptable', label: '💰 Comptable' },
  ];

  return (
    <Card withBorder shadow="lg" padding="xl" radius="md" style={{ maxWidth: 500, margin: '0 auto' }}>
      <Title order={3} mb="lg" c="#1b365d">Créer un utilisateur</Title>
      
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
          {error}
        </Alert>
      )}
      
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Nom complet"
            placeholder="Entrez le nom complet"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            size="md"
          />
          
          <TextInput
            label="Login (identifiant)"
            placeholder="Entrez le nom d'utilisateur"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            size="md"
            description="Utilisé pour la connexion"
          />
          
          <TextInput
            label="Téléphone"
            placeholder="Entrez le numéro de téléphone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            size="md"
          />
          
          <PasswordInput
            label="Mot de passe"
            placeholder="Entrez le mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            size="md"
            minLength={4}
          />
          
          <PasswordInput
            label="Confirmer le mot de passe"
            placeholder="Confirmez le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            size="md"
          />
          
          <Select
            label="Rôle"
            placeholder="Sélectionnez un rôle"
            value={role}
            onChange={(value) => setRole(value as Role)}
            data={roleData}
            required
            size="md"
          />
          
          <Button 
            type="submit" 
            loading={loading} 
            fullWidth 
            size="md"
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
          >
            {loading ? 'Création en cours...' : 'Créer l\'utilisateur'}
          </Button>
        </Stack>
      </form>
    </Card>
  );
};

export default Register;