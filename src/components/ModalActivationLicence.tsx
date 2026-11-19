// src/components/ModalActivationLicence.tsx
// Modal d'activation de la version définitive — utilisable depuis n'importe où dans l'app

import { useState } from 'react';
import {
  Modal, Stack, Text, TextInput, Button, Alert,
  Divider, Box, Group, Badge
} from '@mantine/core';
import { IconKey, IconShieldCheck, IconAlertTriangle, IconCalendar } from '@tabler/icons-react';
import { licenceService, LicenceStatus, TRIAL_DAYS } from '../services/licenceService';

interface Props {
  opened: boolean;
  onClose: () => void;
  onActivated: () => void;
  licenceStatus: LicenceStatus | null;
}

export function ModalActivationLicence({ opened, onClose, onActivated, licenceStatus }: Props) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleClose = () => {
    if (loading) return;
    setKey('');
    setError('');
    setSuccessMsg('');
    onClose();
  };

  const handleActivate = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const result = await licenceService.activerLicence(key);
      if (result.success) {
        setSuccessMsg(result.message);
        setTimeout(() => {
          handleClose();
          onActivated();
        }, 1800);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Une erreur inattendue est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const isDefinitif = licenceStatus?.statut === 'DEFINITIF';

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconKey size={18} />
          <Text fw={600}>
            {isDefinitif ? 'Licence active' : 'Activer la version définitive'}
          </Text>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">

        {/* Statut courant */}
        <Box
          style={{
            background: isDefinitif ? '#f0fff4' : licenceStatus?.statut === 'EXPIRE' ? '#fff5f5' : '#f0f8ff',
            border: `1px solid ${isDefinitif ? '#8ce99a' : licenceStatus?.statut === 'EXPIRE' ? '#ffa8a8' : '#74c0fc'}`,
            borderRadius: 8,
            padding: '10px 14px',
          }}
        >
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed">Statut de la licence</Text>
              <Text fw={600} size="sm">
                {isDefinitif
                  ? '✅ Version définitive activée'
                  : licenceStatus?.statut === 'EXPIRE'
                  ? '🔒 Période d\'essai expirée'
                  : `⏳ Version bêta — ${licenceStatus?.joursRestants ?? '?'} jour(s) restant(s)`}
              </Text>
            </div>
            <Badge
              color={isDefinitif ? 'green' : licenceStatus?.statut === 'EXPIRE' ? 'red' : 'blue'}
              variant="filled"
            >
              {isDefinitif ? 'DÉFINITIF' : licenceStatus?.statut === 'EXPIRE' ? 'EXPIRÉ' : 'BÊTA'}
            </Badge>
          </Group>

          {licenceStatus && !isDefinitif && (
            <Group gap={6} mt={6}>
              <IconCalendar size={13} color="#868e96" />
              <Text size="xs" c="dimmed">
                Première utilisation : {new Date(licenceStatus.firstLaunchDate + 'T00:00:00')
                  .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                {' · '}{TRIAL_DAYS} jours d'essai
              </Text>
            </Group>
          )}
        </Box>

        {isDefinitif ? (
          <Alert icon={<IconShieldCheck size={16} />} color="green" variant="light">
            L'application est déjà activée en version définitive. Aucune action requise.
          </Alert>
        ) : (
          <>
            <Divider label="Entrer le code d'activation" labelPosition="center" />

            <Text size="sm" c="dimmed">
              Contactez votre revendeur pour obtenir un code d'activation.
              Une fois activée, l'application fonctionnera sans limitation de durée.
            </Text>

            <TextInput
              label="Code d'activation"
              placeholder="Ex: GC-PRO-2025-XXXX"
              value={key}
              onChange={e => { setKey(e.target.value.toUpperCase()); setError(''); }}
              leftSection={<IconKey size={16} />}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              error={error}
              styles={{ input: { fontFamily: 'monospace', letterSpacing: 1.5 } }}
              disabled={!!successMsg}
            />

            {error && !successMsg && (
              <Alert icon={<IconAlertTriangle size={14} />} color="red" variant="light" py="xs">
                {error}
              </Alert>
            )}

            {successMsg && (
              <Alert icon={<IconShieldCheck size={14} />} color="green" variant="light" py="xs">
                {successMsg}
              </Alert>
            )}

            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" color="gray" onClick={handleClose} disabled={loading}>
                Annuler
              </Button>
              <Button
                leftSection={<IconKey size={16} />}
                onClick={handleActivate}
                loading={loading}
                disabled={key.trim().length < 6 || !!successMsg}
              >
                Activer
              </Button>
            </Group>
          </>
        )}

        {isDefinitif && (
          <Group justify="flex-end">
            <Button variant="light" onClick={handleClose}>Fermer</Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}

export default ModalActivationLicence;
