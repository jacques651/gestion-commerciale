// src/components/parametres/GestionLicence.tsx
// Page unique de gestion de la licence :
//  - Statut clair (essai / définitif / expiré)
//  - Activation client (code fourni par le revendeur)
//  - Espace développeur repliable : rendre définitif en 1 clic, configurer le code
//    d'un client, changer la durée d'essai, réinitialiser en bêta.

import { useEffect, useState } from 'react';
import {
  Stack, Title, Paper, Text, Button, TextInput, PasswordInput, NumberInput, Alert,
  Badge, Group, Divider, Box, ThemeIcon, Center, Loader, Code,
} from '@mantine/core';
import {
  IconKey, IconShieldCheck, IconLock, IconCalendar, IconAlertTriangle, IconCheck,
  IconTool, IconChevronDown, IconChevronUp, IconInfinity, IconRefresh, IconCopy,
} from '@tabler/icons-react';
import { licenceService, LicenceStatus } from '../../services/licenceService';
import { notifications } from '@mantine/notifications';

export default function GestionLicence() {
  const [status, setStatus] = useState<LicenceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Activation client
  const [key, setKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Espace développeur
  const [devOpen, setDevOpen] = useState(false);
  const [master, setMaster] = useState('');
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [devInfo, setDevInfo] = useState<any>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [clientCode, setClientCode] = useState('');
  const [trialDays, setTrialDays] = useState<number>(60);

  const chargerStatut = async () => {
    const s = await licenceService.verifierLicence();
    setStatus(s);
  };

  useEffect(() => { (async () => { setLoading(true); await chargerStatut(); setLoading(false); })(); }, []);

  const rafraichirDev = async () => {
    const info = await licenceService.getLicenceDevInfo(master);
    if (info.success && info.data) {
      setDevInfo(info.data);
      setTrialDays(info.data.trialDays || 60);
      setClientCode(info.data.validActivationKey || '');
    }
  };

  const handleActivate = async () => {
    if (!key.trim()) return;
    setActivating(true); setError(''); setSuccess('');
    try {
      const result = await licenceService.activerLicence(key);
      if (result.success) { setSuccess(result.message); await chargerStatut(); setKey(''); }
      else setError(result.message);
    } catch { setError('Erreur inattendue. Réessayez.'); }
    finally { setActivating(false); }
  };

  const unlockDev = async () => {
    setDevBusy(true);
    const info = await licenceService.getLicenceDevInfo(master);
    setDevBusy(false);
    if (info.success && info.data) {
      setDevUnlocked(true); setDevInfo(info.data);
      setTrialDays(info.data.trialDays || 60);
      setClientCode(info.data.validActivationKey || '');
    } else {
      notifications.show({ title: 'Accès refusé', message: info.message || 'Mot de passe développeur incorrect.', color: 'red' });
    }
  };

  const dev = (fn: () => Promise<{ success: boolean; message: string }>) => async () => {
    setDevBusy(true);
    try {
      const r = await fn();
      notifications.show({ title: r.success ? 'OK' : 'Erreur', message: r.message, color: r.success ? 'green' : 'red' });
      if (r.success) { await chargerStatut(); await rafraichirDev(); }
    } finally { setDevBusy(false); }
  };

  if (loading) return <Center h={300}><Loader size="md" variant="dots" /></Center>;

  const isDefinitif = status?.statut === 'DEFINITIF';
  const isExpire = status?.statut === 'EXPIRE';

  return (
    <Stack gap="md" p="md" maw={640} mx="auto">
      <Title order={3}>Gestion de la licence</Title>

      {/* Statut */}
      <Paper shadow="xs" p="xl" radius="md" withBorder
        style={{ borderLeft: `4px solid ${isDefinitif ? '#2f9e44' : isExpire ? '#c92a2a' : '#1971c2'}` }}>
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <ThemeIcon size={52} radius="xl" color={isDefinitif ? 'green' : isExpire ? 'red' : 'blue'} variant="light">
              {isDefinitif ? <IconShieldCheck size={28} /> : isExpire ? <IconLock size={28} /> : <IconKey size={28} />}
            </ThemeIcon>
            <div>
              <Text fw={700} size="lg">
                {isDefinitif ? 'Version définitive' : isExpire ? "Période d'essai expirée" : 'Version bêta (essai)'}
              </Text>
              <Text size="sm" c="dimmed" mt={2}>{status?.message}</Text>
            </div>
          </Group>
          <Badge size="lg" color={isDefinitif ? 'green' : isExpire ? 'red' : 'blue'} variant="filled">
            {isDefinitif ? 'ACTIF' : isExpire ? 'EXPIRÉ' : `${status?.joursRestants ?? '?'} j`}
          </Badge>
        </Group>

        {!isDefinitif && status && (
          <Box mt="md" pt="md" style={{ borderTop: '1px solid #f1f3f5' }}>
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">Première utilisation</Text>
                <Group gap={6}>
                  <IconCalendar size={14} color="#868e96" />
                  <Text size="sm" fw={500}>
                    {new Date(status.firstLaunchDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </Text>
                </Group>
              </div>
              {!isExpire && (
                <div>
                  <Text size="xs" c="dimmed">Jours restants</Text>
                  <Text size="sm" fw={700} style={{ color: (status.joursRestants ?? 0) <= 7 ? '#c92a2a' : '#2f9e44' }}>
                    {status.joursRestants} jour(s)
                  </Text>
                </div>
              )}
            </Group>
          </Box>
        )}
      </Paper>

      {/* Activation client */}
      {!isDefinitif ? (
        <Paper shadow="xs" p="xl" radius="md" withBorder>
          <Title order={5} mb="xs">Activer la version définitive</Title>
          <Text size="sm" c="dimmed" mb="md">Entrez le code d'activation fourni par votre revendeur.</Text>
          <Divider mb="md" />
          <Stack gap="sm">
            <TextInput
              label="Code d'activation"
              placeholder="Ex: GC-PRO-2025-XXXX"
              value={key}
              onChange={e => { setKey(e.target.value.toUpperCase()); setError(''); setSuccess(''); }}
              leftSection={<IconKey size={16} />}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              styles={{ input: { fontFamily: 'monospace', letterSpacing: 1.5 } }}
              disabled={!!success}
            />
            {error && <Alert icon={<IconAlertTriangle size={14} />} color="red" variant="light">{error}</Alert>}
            {success && <Alert icon={<IconCheck size={14} />} color="green" variant="light">{success}</Alert>}
            <Group justify="flex-end">
              <Button leftSection={<IconShieldCheck size={16} />} onClick={handleActivate} loading={activating}
                disabled={key.trim().length < 6 || !!success} size="md">
                Activer maintenant
              </Button>
            </Group>
          </Stack>
        </Paper>
      ) : (
        <Alert icon={<IconShieldCheck size={16} />} color="green" variant="light">
          Application activée en version définitive. Aucune expiration.
        </Alert>
      )}

      {/* Espace développeur */}
      <Paper shadow="xs" p="md" radius="md" withBorder>
        <Group justify="space-between" style={{ cursor: 'pointer' }} onClick={() => setDevOpen(o => !o)}>
          <Group gap="xs">
            <ThemeIcon size={30} radius="md" color="gray" variant="light"><IconTool size={16} /></ThemeIcon>
            <div>
              <Text fw={600} size="sm">Espace développeur</Text>
              <Text size="xs" c="dimmed">Réservé — rendre définitif, configurer un client, durée d'essai…</Text>
            </div>
          </Group>
          {devOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
        </Group>

        {devOpen && (<Box>
          <Divider my="md" />
          {!devUnlocked ? (
            <Stack gap="sm">
              <PasswordInput
                label="Mot de passe développeur"
                placeholder="********"
                value={master}
                onChange={e => setMaster(e.currentTarget.value)}
                onKeyDown={e => e.key === 'Enter' && unlockDev()}
                leftSection={<IconLock size={16} />}
              />
              <Group justify="flex-end">
                <Button variant="light" onClick={unlockDev} loading={devBusy} disabled={!master.trim()}>Déverrouiller</Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="md">
              {devInfo && (
                <Paper withBorder p="sm" radius="md" bg="gray.0">
                  <Group gap="xl">
                    <div><Text size="xs" c="dimmed">Type</Text><Text size="sm" fw={600}>{devInfo.licenceType}</Text></div>
                    <div><Text size="xs" c="dimmed">Statut</Text><Text size="sm" fw={600}>{devInfo.statut}</Text></div>
                    <div><Text size="xs" c="dimmed">Durée d'essai</Text><Text size="sm" fw={600}>{devInfo.trialDays} j</Text></div>
                    <div><Text size="xs" c="dimmed">Jours restants</Text><Text size="sm" fw={600}>{devInfo.joursRestants} j</Text></div>
                  </Group>
                </Paper>
              )}

              <Box>
                <Text fw={600} size="sm" mb={4}>Cette installation (pour toi)</Text>
                <Group>
                  <Button color="green" leftSection={<IconInfinity size={16} />} loading={devBusy}
                    disabled={isDefinitif}
                    onClick={dev(() => licenceService.activerDefinitifDev(master))}>
                    {isDefinitif ? 'Déjà définitive' : 'Rendre cette installation définitive'}
                  </Button>
                  <Button variant="light" color="orange" leftSection={<IconRefresh size={16} />} loading={devBusy}
                    onClick={dev(() => licenceService.resetLicence(master))}>
                    Réinitialiser en bêta
                  </Button>
                </Group>
              </Box>

              <Divider />

              <Box>
                <Text fw={600} size="sm" mb={4}>Pour revendre à un client</Text>
                <Text size="xs" c="dimmed" mb="xs">
                  Définis un code d'activation unique, puis donne-le au client : il l'entrera dans « Activer la version définitive ».
                </Text>
                <Group align="flex-end">
                  <TextInput style={{ flex: 1 }} label="Code d'activation du client"
                    placeholder="Ex: GC-PRO-2025-CLIENT01"
                    value={clientCode}
                    onChange={e => setClientCode(e.currentTarget.value.toUpperCase())}
                    styles={{ input: { fontFamily: 'monospace' } }} />
                  <Button loading={devBusy} disabled={clientCode.trim().length < 6}
                    onClick={dev(() => licenceService.configurerCleClient(master, clientCode))}>
                    Enregistrer le code
                  </Button>
                </Group>
                {devInfo?.validActivationKey && (
                  <Group gap={6} mt={6}>
                    <Text size="xs" c="dimmed">Code actuel :</Text>
                    <Code>{devInfo.validActivationKey}</Code>
                    <ThemeIcon size="sm" variant="subtle" color="gray" style={{ cursor: 'pointer' }}
                      onClick={() => { navigator.clipboard?.writeText(devInfo.validActivationKey); notifications.show({ message: 'Code copié', color: 'green' }); }}>
                      <IconCopy size={14} />
                    </ThemeIcon>
                  </Group>
                )}
              </Box>

              <Divider />

              <Box>
                <Text fw={600} size="sm" mb={4}>Durée de la période d'essai</Text>
                <Group align="flex-end">
                  <NumberInput style={{ width: 160 }} label="Jours" min={1} max={3650}
                    value={trialDays} onChange={v => setTrialDays(Number(v) || 60)} />
                  <Button variant="light" loading={devBusy}
                    onClick={dev(() => licenceService.configurerDureeEssai(master, trialDays))}>
                    Appliquer
                  </Button>
                </Group>
              </Box>
            </Stack>
          )}
        </Box>)}
      </Paper>
    </Stack>
  );
}
