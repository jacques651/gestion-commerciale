// src/components/common/ModalProfil.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Avatar,
  Text,
  Divider,
  Switch,
  Select,
  PasswordInput,
  LoadingOverlay,
  Badge
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUser, IconCheck, IconX } from '@tabler/icons-react';
import { userService, UserProfile } from '../../services/userService';

interface ModalProfilProps {
  opened: boolean;
  onClose: () => void;
  userName: string;
  userRole: string;
  onUpdate?: () => void;
}

export const ModalProfil: React.FC<ModalProfilProps> = ({ opened, onClose, userName, userRole, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    telephone: '',
    theme: 'light',
    notifications: true
  });
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (opened) {
      loadProfile();
    }
  }, [opened]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await userService.getCurrentUserProfile();
      setProfile(data);
      if (data) {
        setFormData({
          email: data.email || '',
          telephone: data.telephone || '',
          theme: data.theme || 'light',
          notifications: data.notifications !== false
        });
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const success = await userService.updateUserProfile(profile.id, {
        email: formData.email,
        telephone: formData.telephone,
        theme: formData.theme,
        notifications: formData.notifications
      });
      
      if (success) {
        notifications.show({
          title: '✅ Succès',
          message: 'Profil mis à jour avec succès',
          color: 'green'
        });
        if (onUpdate) onUpdate();
        onClose();
      } else {
        notifications.show({
          title: '❌ Erreur',
          message: 'Erreur lors de la mise à jour',
          color: 'red'
        });
      }
    } catch (error) {
      notifications.show({
        title: '❌ Erreur',
        message: 'Erreur lors de la mise à jour',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      notifications.show({
        title: 'Erreur',
        message: 'Les mots de passe ne correspondent pas',
        color: 'red'
      });
      return;
    }
    
    if (passwordData.newPassword.length < 4) {
      notifications.show({
        title: 'Erreur',
        message: 'Le mot de passe doit contenir au moins 4 caractères',
        color: 'red'
      });
      return;
    }
    
    setLoading(true);
    try {
      const success = await userService.changePassword(
        profile!.id,
        passwordData.oldPassword,
        passwordData.newPassword
      );
      
      if (success) {
        notifications.show({
          title: '✅ Succès',
          message: 'Mot de passe modifié avec succès',
          color: 'green'
        });
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        notifications.show({
          title: '❌ Erreur',
          message: 'Ancien mot de passe incorrect',
          color: 'red'
        });
      }
    } catch (error) {
      notifications.show({
        title: '❌ Erreur',
        message: 'Erreur lors du changement de mot de passe',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconUser size={24} color="#228be6" />
          <Text fw={700} size="lg">Mon profil</Text>
        </Group>
      }
      size="md"
      centered
      padding="lg"
    >
      <LoadingOverlay visible={loading} />
      
      <Stack gap="md">
        {/* Avatar et infos */}
        <Group justify="center">
          <Avatar size={100} radius={100} color="blue">
            {getInitials(userName)}
          </Avatar>
        </Group>
        
        <Group justify="center">
          <Text fw={700} size="lg">{userName}</Text>
          <Badge color="yellow" variant="light">{userRole}</Badge>
        </Group>
        
        <Divider label="Informations personnelles" labelPosition="center" />
        
        {/* Formulaire */}
        <TextInput
          label="Email"
          placeholder="votre@email.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          description="Votre adresse email professionnelle"
        />
        
        <TextInput
          label="Téléphone"
          placeholder="+225 XX XX XX XX"
          value={formData.telephone}
          onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
          description="Numéro de contact"
        />
        
        <Select
          label="Thème"
          value={formData.theme}
          onChange={(value) => setFormData({ ...formData, theme: value || 'light' })}
          data={[
            { value: 'light', label: '☀️ Clair' },
            { value: 'dark', label: '🌙 Sombre' }
          ]}
        />
        
        <Switch
          label="Activer les notifications"
          description="Recevoir des alertes par email"
          checked={formData.notifications}
          onChange={(e) => setFormData({ ...formData, notifications: e.currentTarget.checked })}
          size="md"
        />
        
        <Divider label="Changer le mot de passe" labelPosition="center" />
        
        <PasswordInput
          label="Mot de passe actuel"
          placeholder="Entrez votre mot de passe actuel"
          value={passwordData.oldPassword}
          onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
        />
        
        <PasswordInput
          label="Nouveau mot de passe"
          placeholder="Entrez votre nouveau mot de passe"
          value={passwordData.newPassword}
          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
        />
        
        <PasswordInput
          label="Confirmer le mot de passe"
          placeholder="Confirmez votre nouveau mot de passe"
          value={passwordData.confirmPassword}
          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
        />
        
        <Button 
          variant="light" 
          color="blue" 
          onClick={handleChangePassword}
          disabled={!passwordData.oldPassword || !passwordData.newPassword}
        >
          Changer le mot de passe
        </Button>
        
        <Divider />
        
        {/* Boutons action */}
        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose} leftSection={<IconX size={16} />}>
            Annuler
          </Button>
          <Button onClick={handleUpdateProfile} color="green" leftSection={<IconCheck size={16} />}>
            Enregistrer les modifications
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};