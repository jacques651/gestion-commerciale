// src/components/parametres/BackupRestore.tsx
import React, { useState } from 'react';
import { confirm } from '../../utils/confirm';
import { Card, Button, Group, Stack, Text, Alert, LoadingOverlay } from '@mantine/core';
import { IconDatabase, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export const BackupRestore: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      // Simulation de backup - à implémenter avec Tauri
      notifications.show({
        title: 'Information',
        message: 'Fonctionnalité en cours de développement',
        color: 'blue',
      });
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la sauvegarde',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (await confirm('La restauration va remplacer la base actuelle. Continuer ?', 'Restauration')) {
      setLoading(true);
      try {
        notifications.show({
          title: 'Information',
          message: 'Fonctionnalité en cours de développement',
          color: 'blue',
        });
      } catch (error) {
        notifications.show({
          title: 'Erreur',
          message: 'Erreur lors de la restauration',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Card withBorder p="lg" pos="relative">
      <LoadingOverlay visible={loading} />
      <Stack gap="md">
        <Text fw={600} size="lg">🗄️ Sauvegarde et restauration</Text>
        
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          Il est recommandé de faire une sauvegarde régulièrement pour éviter toute perte de données.
        </Alert>
        
        <Group>
          <Button 
            leftSection={<IconDatabase size={18} />} 
            onClick={handleBackup}
            color="green"
          >
            Sauvegarder la base
          </Button>
          
          <Button 
            leftSection={<IconRefresh size={18} />} 
            onClick={handleRestore}
            color="orange"
            variant="outline"
          >
            Restaurer une sauvegarde
                </Button>
        </Group>
      </Stack>
    </Card>
  );
};

export default BackupRestore;
