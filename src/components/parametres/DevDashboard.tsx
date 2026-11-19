// src/components/parametres/DevDashboard.tsx
// Dashboard Développeur — accès protégé par mot de passe

import { useState } from 'react';
import {
  Stack, Title, Paper, Text, Button, TextInput, Alert,
  Badge, Group, Divider, Box, ThemeIcon, Center,
  PasswordInput, ActionIcon, Tooltip, Modal, NumberInput
} from '@mantine/core';
import {
  IconKey, IconShieldCheck, IconLock, IconCalendar,
  IconAlertTriangle, IconCheck, IconCopy, IconRefresh,
  IconSettings, IconArrowLeft, IconTrash, IconClock
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { licenceService } from '../../services/licenceService';

interface DevInfo {
  statut: string;
  licenceType: string;
  firstLaunchDate: string;
  validActivationKey: string | null;
  licenceKeyUsed: string | null;
  joursRestants: number;
  trialDays: number;
  createdAt: string;
}

const genererCodeActivation = () => {
  const annee = new Date().getFullYear();
  const suffixe = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GC-PRO-${annee}-${suffixe}`;
};

export default function DevDashboard() {
  const navigate = useNavigate();

  // Écran de connexion
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logging, setLogging] = useState(false);

  // État après connexion
  const [masterKey, setMasterKey] = useState('');
  const [devInfo, setDevInfo] = useState<DevInfo | null>(null);

  // Actions
  const [newKey, setNewKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [copied, setCopied] = useState(false);

  // Durée d'essai
  const [trialInput, setTrialInput] = useState<number | string>(60);
  const [trialSaving, setTrialSaving] = useState(false);
  const [trialMsg, setTrialMsg] = useState('');
  const [trialError, setTrialError] = useState('');

  // Modal réinitialisation
  const [resetModal, setResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const handleLogin = async () => {
    if (!password.trim()) return;
    setLogging(true);
    setLoginError('');
    try {
      const result = await licenceService.getLicenceDevInfo(password.trim());
      if (result.success && result.data) {
        setMasterKey(password.trim());
        setDevInfo(result.data);
        setTrialInput(result.data.trialDays);
        setNewKey(result.data.validActivationKey || genererCodeActivation());
        setPassword('');
      } else {
        setLoginError(result.message || 'Mot de passe incorrect.');
      }
    } catch {
      setLoginError('Erreur de connexion. Réessayez.');
    } finally {
      setLogging(false);
    }
  };

  const rafraichir = async () => {
    const result = await licenceService.getLicenceDevInfo(masterKey);
    if (result.success && result.data) {
      setDevInfo(result.data);
      setTrialInput(result.data.trialDays);
    }
  };

  const handleSaveTrialDays = async () => {
    const jours = Number(trialInput);
    if (!jours || jours < 1) { setTrialError('Entrez un nombre de jours valide.'); return; }
    setTrialSaving(true);
    setTrialMsg('');
    setTrialError('');
    try {
      const result = await licenceService.configurerDureeEssai(masterKey, jours);
      if (result.success) {
        setTrialMsg(result.message);
        await rafraichir();
      } else {
        setTrialError(result.message);
      }
    } catch {
      setTrialError('Erreur inattendue.');
    } finally {
      setTrialSaving(false);
    }
  };

  const handleSaveKey = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      const result = await licenceService.configurerCleClient(masterKey, newKey);
      if (result.success) {
        setSaveMsg(`Code enregistré : ${newKey.trim().toUpperCase()}`);
        setNewKey('');
        await rafraichir();
      } else {
        setSaveError(result.message);
      }
    } catch {
      setSaveError('Erreur inattendue.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = async () => {
    setResetting(true);
    setResetMsg('');
    try {
      const result = await licenceService.resetLicence(masterKey);
      if (result.success) {
        setResetMsg(result.message);
        await rafraichir();
        setTimeout(() => setResetModal(false), 1500);
      }
    } catch {
      setResetMsg('Erreur lors de la réinitialisation.');
    } finally {
      setResetting(false);
    }
  };

  const fmt = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

  // ── Écran de connexion ────────────────────────────────────────────────────
  if (!devInfo) {
    return (
      <Center style={{ width: '100%', minHeight: '70vh' }}>
        <Paper shadow="md" p="xl" radius="lg" style={{ width: 420, maxWidth: '95vw' }} withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" color="dark" variant="light">
              <IconLock size={32} />
            </ThemeIcon>
            <div style={{ textAlign: 'center' }}>
              <Title order={3}>Dashboard Développeur</Title>
              <Text size="sm" c="dimmed" mt={4}>Accès réservé — entrez votre mot de passe</Text>
            </div>

            <Divider style={{ width: '100%' }} />

            <PasswordInput
              style={{ width: '100%' }}
              label="Mot de passe développeur"
              placeholder="Votre mot de passe"
              value={password}
              onChange={e => { setPassword(e.target.value); setLoginError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              leftSection={<IconKey size={16} />}
              error={loginError}
              autoFocus
            />

            <Button
              fullWidth
              leftSection={<IconShieldCheck size={16} />}
              onClick={handleLogin}
              loading={logging}
              disabled={password.trim().length < 4}
            >
              Accéder au dashboard
            </Button>

            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate('/licence')}
            >
              Retour à la licence
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  // ── Dashboard (après connexion) ───────────────────────────────────────────
  const isDefinitif = devInfo.licenceType === 'DEFINITIF';
  const isExpire = devInfo.statut === 'EXPIRE';

  return (
    <Stack gap="md" p="md" maw={680} mx="auto">

      {/* En-tête */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconSettings size={20} color="#1971c2" />
          <Title order={3} style={{ color: '#1971c2' }}>Dashboard Développeur</Title>
        </Group>
        <Group gap="xs">
          <Tooltip label="Actualiser">
            <ActionIcon variant="light" color="blue" onClick={rafraichir}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate('/licence')}
          >
            Retour
          </Button>
        </Group>
      </Group>

      {/* ── Statut licence client ── */}
      <Paper shadow="xs" p="lg" radius="md" withBorder
        style={{ borderLeft: `4px solid ${isDefinitif ? '#2f9e44' : isExpire ? '#c92a2a' : '#1971c2'}` }}
      >
        <Title order={5} mb="md">Statut de la licence — client actuel</Title>
        <Group gap="xl" wrap="wrap">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Statut</Text>
            <Badge
              size="lg"
              color={isDefinitif ? 'green' : isExpire ? 'red' : 'blue'}
              variant="filled"
              mt={4}
            >
              {isDefinitif ? 'DÉFINITIF' : isExpire ? 'EXPIRÉ' : 'BÊTA'}
            </Badge>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Première utilisation</Text>
            <Group gap={6} mt={4}>
              <IconCalendar size={14} color="#868e96" />
              <Text size="sm" fw={500}>{fmt(devInfo.firstLaunchDate)}</Text>
            </Group>
          </div>
          {!isDefinitif && (
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Jours restants</Text>
              <Text size="sm" fw={700} mt={4}
                style={{ color: devInfo.joursRestants <= 7 ? '#c92a2a' : '#2f9e44' }}>
                {devInfo.joursRestants} jour(s)
              </Text>
            </div>
          )}
        </Group>
      </Paper>

      {/* ── Durée d'essai ── */}
      {!isDefinitif && (
        <Paper shadow="xs" p="lg" radius="md" withBorder>
          <Group gap="xs" mb="md">
            <IconClock size={18} color="#1971c2" />
            <Title order={5}>Durée de la période d'essai</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Durée actuelle : <strong>{devInfo.trialDays} jours</strong> — le client a encore <strong>{devInfo.joursRestants} jour(s)</strong> restant(s).
            Modifier la durée recalcule automatiquement les jours restants.
          </Text>
          <Group gap="sm" align="flex-end">
            <NumberInput
              style={{ width: 180 }}
              label="Durée d'essai (jours)"
              min={1}
              max={3650}
              value={trialInput}
              onChange={val => { setTrialInput(val); setTrialMsg(''); setTrialError(''); }}
              leftSection={<IconClock size={16} />}
            />
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={handleSaveTrialDays}
              loading={trialSaving}
              disabled={Number(trialInput) < 1 || Number(trialInput) === devInfo.trialDays}
            >
              Appliquer
            </Button>
          </Group>
          {trialError && (
            <Alert icon={<IconAlertTriangle size={14} />} color="red" variant="light" mt="sm">{trialError}</Alert>
          )}
          {trialMsg && (
            <Alert icon={<IconCheck size={14} />} color="green" variant="light" mt="sm">{trialMsg}</Alert>
          )}
        </Paper>
      )}

      {/* ── Code d'activation configuré ── */}
      <Paper shadow="xs" p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Code d'activation configuré pour ce client</Title>

        {devInfo.validActivationKey ? (
          <Box
            style={{
              background: '#f0fff4',
              border: '1px solid #8ce99a',
              borderRadius: 8,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div>
              <Text size="xs" c="dimmed" mb={2}>Code à donner au client</Text>
              <Text
                size="lg"
                fw={700}
                style={{ fontFamily: 'monospace', letterSpacing: 2, color: '#2f9e44' }}
              >
                {devInfo.validActivationKey}
              </Text>
            </div>
            <Tooltip label={copied ? 'Copié !' : 'Copier le code'}>
              <ActionIcon
                color={copied ? 'green' : 'blue'}
                variant="light"
                size="lg"
                onClick={() => handleCopy(devInfo.validActivationKey!)}
              >
                {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
              </ActionIcon>
            </Tooltip>
          </Box>
        ) : (
          <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
            Aucun code configuré pour ce client. Utilisez le formulaire ci-dessous pour en créer un.
          </Alert>
        )}

        <Box
          mt="sm"
          style={{
            background: devInfo.licenceKeyUsed ? '#f0fff4' : '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            padding: '8px 14px'
          }}
        >
          <Text size="xs" c="dimmed">Code utilisé par le client pour l'activation</Text>
          <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
            {devInfo.licenceKeyUsed
              ? <span style={{ color: '#2f9e44' }}>{devInfo.licenceKeyUsed} ✓</span>
              : <span style={{ color: '#868e96' }}>Non encore activé</span>}
          </Text>
        </Box>
      </Paper>

      {/* ── Création guidée de la licence client ── */}
      <Paper shadow="xs" p="lg" radius="md" withBorder>
        <Title order={5} mb="xs">
          {devInfo.validActivationKey ? 'Créer un nouveau code de licence' : 'Créer la licence du client'}
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Générez le code puis créez la licence. Donnez ensuite ce code au client pour qu'il puisse activer son application.
        </Text>
        <Group gap="sm" align="flex-end">
          <TextInput
            style={{ flex: 1 }}
            label="Code de licence"
            placeholder="Ex: KOSOFT-CLIENT-NOM"
            value={newKey}
            onChange={e => { setNewKey(e.target.value.toUpperCase()); setSaveMsg(''); setSaveError(''); }}
            leftSection={<IconKey size={16} />}
            onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
            styles={{ input: { fontFamily: 'monospace', letterSpacing: 1.5 } }}
          />
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            onClick={() => { setNewKey(genererCodeActivation()); setSaveMsg(''); setSaveError(''); }}
          >
            Générer un code
          </Button>
          <Button
            leftSection={<IconShieldCheck size={16} />}
            onClick={handleSaveKey}
            loading={saving}
            disabled={newKey.trim().length < 6}
          >
            Créer la licence
          </Button>
        </Group>
        {saveError && (
          <Alert icon={<IconAlertTriangle size={14} />} color="red" variant="light" mt="sm">{saveError}</Alert>
        )}
        {saveMsg && (
          <Alert icon={<IconCheck size={14} />} color="green" variant="light" mt="sm">{saveMsg}</Alert>
        )}
      </Paper>

      {/* ── Zone dangereuse ── */}
      {isDefinitif && (
        <Paper shadow="xs" p="lg" radius="md" withBorder style={{ borderColor: '#ffa8a8' }}>
          <Title order={5} mb="xs" c="red">Zone dangereuse</Title>
          <Text size="sm" c="dimmed" mb="md">
            Réinitialiser remet la licence en mode BÊTA (utile en cas d'erreur de configuration).
            Le client devra de nouveau activer son application.
          </Text>
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={16} />}
            onClick={() => setResetModal(true)}
          >
            Réinitialiser la licence en BÊTA
          </Button>
        </Paper>
      )}

      {/* Modal confirmation réinitialisation */}
      <Modal
        opened={resetModal}
        onClose={() => { if (!resetting) setResetModal(false); }}
        title="Confirmer la réinitialisation"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
            Cette action remet la licence en BÊTA. Le client devra entrer son code d'activation pour réactiver l'application.
          </Alert>
          {resetMsg && (
            <Alert icon={<IconCheck size={14} />} color="green" variant="light">{resetMsg}</Alert>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setResetModal(false)} disabled={resetting}>
              Annuler
            </Button>
            <Button color="red" onClick={handleReset} loading={resetting} disabled={!!resetMsg}>
              Confirmer la réinitialisation
            </Button>
          </Group>
        </Stack>
      </Modal>

    </Stack>
  );
}
