// src/components/EcranExpiration.tsx
// Écran de verrouillage affiché quand la période d'essai est expirée

import { useState } from 'react';
import {
  Center, Paper, Stack, Title, Text, TextInput, Button,
  Alert, Badge, Divider, Box, ThemeIcon
} from '@mantine/core';
import {
  IconLock, IconKey, IconAlertTriangle, IconCalendar, IconShieldCheck
} from '@tabler/icons-react';
import { licenceService, LicenceStatus, TRIAL_DAYS } from '../services/licenceService';

interface Props {
  status: LicenceStatus;
  onActivated: () => void;
}

export function EcranExpiration({ status, onActivated }: Props) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleActivate = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const result = await licenceService.activerLicence(key);
      if (result.success) {
        setSuccessMsg(result.message);
        setTimeout(() => onActivated(), 2000);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Une erreur inattendue est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const firstLaunchFormatted = status.firstLaunchDate
    ? new Date(status.firstLaunchDate + 'T00:00:00').toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    : '—';

  return (
    <Center
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #0a1628 0%, #1a2d5a 100%)',
      }}
    >
      <Paper
        shadow="xl"
        p="xl"
        radius="lg"
        style={{ width: 480, maxWidth: '92vw' }}
      >
        <Stack align="center" gap="md">

          {/* Icône */}
          <ThemeIcon size={72} radius="xl" color="red" variant="light">
            <IconLock size={40} />
          </ThemeIcon>

          {/* Titre */}
          <Title order={2} ta="center" c="red.7">
            Période d'essai expirée
          </Title>

          <Badge color="red" size="lg" variant="filled">
            Application verrouillée
          </Badge>

          <Divider style={{ width: '100%' }} />

          {/* Info durée */}
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="orange"
            variant="light"
            style={{ width: '100%' }}
          >
            <Text size="sm">
              Votre période d'essai gratuite de <strong>{TRIAL_DAYS} jours</strong> est terminée.
              Pour continuer à utiliser l'application, vous devez activer la version définitive.
            </Text>
          </Alert>

          {/* Date de première utilisation */}
          <Box
            style={{
              width: '100%',
              background: '#f8f9fa',
              borderRadius: 8,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <IconCalendar size={18} color="#868e96" />
            <div>
              <Text size="xs" c="dimmed">Première utilisation</Text>
              <Text size="sm" fw={600}>{firstLaunchFormatted}</Text>
            </div>
          </Box>

          <Divider label="Activer la version définitive" labelPosition="center" style={{ width: '100%' }} />

          {/* Saisie du code */}
          <TextInput
            label="Code d'activation"
            description="Contactez votre revendeur pour obtenir votre code."
            placeholder="Ex: GC-PRO-2025-XXXX"
            value={key}
            onChange={e => { setKey(e.target.value.toUpperCase()); setError(''); }}
            leftSection={<IconKey size={16} />}
            style={{ width: '100%' }}
            onKeyDown={e => e.key === 'Enter' && handleActivate()}
            error={error}
            styles={{ input: { fontFamily: 'monospace', letterSpacing: 2 } }}
            disabled={!!successMsg}
          />

          {/* Feedback succès */}
          {successMsg && (
            <Alert
              icon={<IconShieldCheck size={18} />}
              color="green"
              variant="light"
              style={{ width: '100%' }}
            >
              {successMsg}<br />
              <Text size="xs" mt={4}>Rechargement en cours...</Text>
            </Alert>
          )}

          {/* Bouton activation */}
          {!successMsg && (
            <Button
              fullWidth
              size="md"
              color="blue"
              leftSection={<IconKey size={18} />}
              onClick={handleActivate}
              loading={loading}
              disabled={key.trim().length < 6}
            >
              Activer la version définitive
            </Button>
          )}

          <Text size="xs" c="dimmed" ta="center">
            Pour toute assistance, contactez le développeur de l'application.
          </Text>

        </Stack>
      </Paper>
    </Center>
  );
}

export default EcranExpiration;
