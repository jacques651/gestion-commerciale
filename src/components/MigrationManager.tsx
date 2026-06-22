// src/components/MigrationManager.tsx

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Progress,
  Alert,
  Group,
  Badge,
  Paper,
  ThemeIcon,
  LoadingOverlay,
  List,
} from '@mantine/core';
import {
  IconDatabase,
  IconCheck,
  IconAlertCircle,
  IconRefresh,
  IconUpload,
  IconDownload,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { MigrationManager } from '../database/migrations';
import { BackupManager } from '../database/backupManager';

interface MigrationManagerComponentProps {
  onComplete: () => void;
}

export const MigrationManagerComponent: React.FC<MigrationManagerComponentProps> = ({ onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [status, setStatus] = useState<{
    currentVersion: number;
    latestVersion: number;
    pendingMigrations: any[];
    hasBackup: boolean;
  } | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const statusData = await MigrationManager.getMigrationStatus();
      setStatus(statusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setProgress(0);
    setError(null);

    try {
      // Étape 1: Sauvegarde
      setProgress(25);
      const backup = await BackupManager.createBackup();
      notifications.show({
        title: '💾 Sauvegarde',
        message: `Sauvegarde créée: ${backup.id}`,
        color: 'blue',
      });

      // Étape 2: Migration
      setProgress(50);
      await MigrationManager.runMigrations();

      // Étape 3: Vérification
      setProgress(75);
      const newStatus = await MigrationManager.getMigrationStatus();

      // Étape 4: Terminé
      setProgress(100);
      setStatus(newStatus);

      notifications.show({
        title: '✅ Succès',
        message: 'Migration terminée avec succès !',
        color: 'green',
      });

      setTimeout(() => {
        onComplete();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la migration');
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur lors de la migration',
        color: 'red',
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleRestoreLatest = async () => {
    const backups = BackupManager.getBackupList();
    if (backups.length === 0) return;

    const latest = backups[backups.length - 1];
    if (!confirm(`Restaurer la sauvegarde ${latest.id} ?`)) return;

    setMigrating(true);
    try {
      await BackupManager.restoreBackup(latest.id);
      notifications.show({
        title: '✅ Succès',
        message: 'Sauvegarde restaurée avec succès !',
        color: 'green',
      });
      await loadStatus();
    } catch (err) {
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur lors de la restauration',
        color: 'red',
      });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <Modal opened={true} onClose={() => {}} size="lg" centered withCloseButton={false}>
        <LoadingOverlay visible={true} />
        <Text ta="center" py={50}>Vérification de la base de données...</Text>
      </Modal>
    );
  }

  const needsMigration = status && status.pendingMigrations.length > 0;

  return (
    <Modal
      opened={true}
      onClose={() => !migrating && !needsMigration && onComplete()}
      size="lg"
      centered
      withCloseButton={!migrating && !needsMigration}
      title={
        <Group>
          <ThemeIcon size={30} radius="xl" color={needsMigration ? 'orange' : 'green'}>
            {needsMigration ? <IconAlertCircle size={18} /> : <IconCheck size={18} />}
          </ThemeIcon>
          <Text fw={600} size="lg">Gestionnaire de migration</Text>
        </Group>
      }
    >
      <LoadingOverlay visible={migrating} />

      <Stack gap="md">
        {/* Informations de version */}
        <Paper withBorder p="md" radius="md" bg="gray.0">
          <Group justify="space-between">
            <Group>
              <IconDatabase size={20} color="#1b365d" />
              <div>
                <Text size="sm" fw={600}>Version actuelle</Text>
                <Text size="xl" fw={700}>v{status?.currentVersion || 0}</Text>
              </div>
            </Group>
            <Group>
              <Badge color={needsMigration ? 'orange' : 'green'} size="lg">
                {needsMigration ? 'Mise à jour disponible' : 'À jour'}
              </Badge>
              <Badge color="blue" size="lg">v{status?.latestVersion || 0}</Badge>
            </Group>
          </Group>
        </Paper>

        {/* Migration nécessaire */}
        {needsMigration && (
          <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
            <Text fw={600}>Migration nécessaire</Text>
            <Text size="sm">
              {status.pendingMigrations.length} migration(s) en attente.
              Une sauvegarde sera créée avant la migration.
            </Text>
          </Alert>
        )}

        {/* Liste des migrations */}
        {status?.pendingMigrations && status.pendingMigrations.length > 0 && (
          <Paper withBorder p="md" radius="md">
            <Text size="sm" fw={600} mb="xs">Migrations à appliquer :</Text>
            <List spacing="xs" size="sm">
              {status.pendingMigrations.map((m, idx) => (
                <List.Item key={idx}>
                  <Group>
                    <Badge size="sm" color="blue">v{m.version}</Badge>
                    <Text>{m.name}</Text>
                    <Text size="xs" c="dimmed">{m.description}</Text>
                  </Group>
                </List.Item>
              ))}
            </List>
          </Paper>
        )}

        {/* Progression */}
        {migrating && (
          <Stack gap="xs">
            <Progress value={progress} color={error ? 'red' : 'blue'} size="lg" />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {progress < 25 && 'Création de la sauvegarde...'}
                {progress >= 25 && progress < 50 && 'Migration en cours...'}
                {progress >= 50 && progress < 75 && 'Vérification...'}
                {progress >= 75 && progress < 100 && 'Finalisation...'}
                {progress >= 100 && '✅ Terminé !'}
              </Text>
              <Text size="sm" fw={600}>{Math.round(progress)}%</Text>
            </Group>
          </Stack>
        )}

        {/* Erreur */}
        {error && (
          <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />}>
            <Text fw={600}>Erreur</Text>
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        {/* Actions */}
        <Group justify="flex-end" gap="xs">
          {status?.hasBackup && (
            <Button
              variant="light"
              color="orange"
              onClick={handleRestoreLatest}
              disabled={migrating}
              leftSection={<IconDownload size={16} />}
            >
              Restaurer la dernière sauvegarde
            </Button>
          )}

          {needsMigration ? (
            <Button
              onClick={handleMigrate}
              loading={migrating}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              leftSection={<IconUpload size={16} />}
            >
              Lancer la migration
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              color="green"
              leftSection={<IconCheck size={16} />}
            >
              Continuer
            </Button>
          )}

          <Button
            variant="subtle"
            onClick={loadStatus}
            disabled={migrating}
            leftSection={<IconRefresh size={16} />}
          >
            Vérifier
          </Button>
        </Group>

        {/* Sauvegardes disponibles */}
        {!needsMigration && (
          <Alert color="blue" variant="light" icon={<IconDatabase size={16} />}>
            <Group>
              <Text size="sm">
                💾 {BackupManager.getBackupList().length} sauvegarde(s) disponible(s)
              </Text>
            </Group>
          </Alert>
        )}
      </Stack>
    </Modal>
  );
};