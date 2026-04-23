// src/components/clients/FormulaireClient.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  TextInput,
  Select,
  Divider,
  Alert,
  Box,
  Modal,
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconArrowLeft,
  IconUser,
  IconInfoCircle,
  IconCheck,
  IconAlertCircle,
  IconPhone,
  IconMail,
  IconMapPin,
  IconBuildingStore,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';

interface Client {
  idClient?: number;
  code_client: string;
  nom_complet: string;
  societe: string;
  type_client: string;
  adresse: string;
  ville: string;
  telephone: string;
  email: string;
}

interface FormulaireClientProps {
  client?: Client;
  onSuccess: () => void;
  onCancel: () => void;
}

const FormulaireClient: React.FC<FormulaireClientProps> = ({ client, onSuccess, onCancel }) => {
  const [codeClient, setCodeClient] = useState('');
  const [nomComplet, setNomComplet] = useState('');
  const [societe, setSociete] = useState('');
  const [typeClient, setTypeClient] = useState<string | null>('PARTICULIER');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const typesOptions = [
    { value: 'PARTICULIER', label: '👤 Particulier' },
    { value: 'REVENDEUR', label: '🔄 Revendeur' },
    { value: 'ENTREPRISE', label: '🏢 Entreprise' },
  ];

  useEffect(() => {
    if (client) {
      setCodeClient(client.code_client);
      setNomComplet(client.nom_complet);
      setSociete(client.societe || '');
      setTypeClient(client.type_client);
      setAdresse(client.adresse || '');
      setVille(client.ville || '');
      setTelephone(client.telephone || '');
      setEmail(client.email || '');
    } else {
      const code = `CLT-${Date.now()}`;
      setCodeClient(code);
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!nomComplet.trim()) {
      setError('Le nom complet est obligatoire');
      return;
    }

    setLoading(true);

    try {
      const db = await getDb();

      if (client?.idClient) {
        await db.execute(`
          UPDATE clients 
          SET code_client=?, nom_complet=?, societe=?, type_client=?, 
              adresse=?, ville=?, telephone=?, email=?
          WHERE idClient=?
        `, [codeClient, nomComplet, societe || null, typeClient, adresse || null, ville || null, telephone || null, email || null, client.idClient]);
        setSuccess(true);
      } else {
        await db.execute(`
          INSERT INTO clients (code_client, nom_complet, societe, type_client, adresse, ville, telephone, email, est_actif, est_supprime)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
        `, [codeClient, nomComplet, societe || null, typeClient, adresse || null, ville || null, telephone || null, email || null]);
        setSuccess(true);
      }

      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box style={{ maxWidth: 800, margin: '0 auto' }} p="sm">
      <Stack gap="md">
        <Card withBorder radius="md" p="sm" bg="#1b365d">
          <Group justify="space-between">
            <Group gap="xs">
              <IconUser size={18} color="white" />
              <Title order={4} size="h5" c="white">
                {client ? 'Modifier le client' : 'Nouveau client'}
              </Title>
            </Group>
            <Group gap="xs">
              <Button
                variant="subtle"
                color="white"
                size="compact-sm"
                leftSection={<IconInfoCircle size={14} />}
                onClick={() => setInfoModalOpen(true)}
              >
                Aide
              </Button>
              <Button
                variant="subtle"
                color="white"
                size="compact-sm"
                leftSection={<IconArrowLeft size={14} />}
                onClick={onCancel}
              >
                Retour
              </Button>
            </Group>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              {success && (
                <Alert icon={<IconCheck size={14} />} color="green" variant="light" p="xs">
                  <Text size="xs">Client {client ? 'modifié' : 'ajouté'} avec succès !</Text>
                </Alert>
              )}

              {error && (
                <Alert icon={<IconAlertCircle size={14} />} color="red" variant="light" p="xs">
                  <Text size="xs">{error}</Text>
                </Alert>
              )}

              <TextInput
                label="Code client"
                value={codeClient}
                disabled
                size="sm"
              />

              <TextInput
                label="Nom complet"
                placeholder="Nom et prénom"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                leftSection={<IconUser size={14} />}
                size="sm"
                required
              />

              <TextInput
                label="Société"
                placeholder="Nom de l'entreprise (optionnel)"
                value={societe}
                onChange={(e) => setSociete(e.target.value)}
                leftSection={<IconBuildingStore size={14} />}
                size="sm"
              />

              <Select
                label="Type de client"
                data={typesOptions}
                value={typeClient}
                onChange={setTypeClient}
                size="sm"
              />

              <TextInput
                label="Téléphone"
                placeholder="Numéro de téléphone"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                leftSection={<IconPhone size={14} />}
                size="sm"
              />

              <TextInput
                label="Email"
                placeholder="adresse@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftSection={<IconMail size={14} />}
                size="sm"
                type="email"
              />

              <TextInput
                label="Adresse"
                placeholder="Adresse complète"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                leftSection={<IconMapPin size={14} />}
                size="sm"
              />

              <TextInput
                label="Ville"
                placeholder="Ville"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                leftSection={<IconMapPin size={14} />}
                size="sm"
              />

              <Divider />

              <Group justify="space-between">
                <Button size="sm" variant="light" color="red" onClick={onCancel}>
                  Annuler
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  loading={loading}
                  leftSection={<IconDeviceFloppy size={14} />}
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                >
                  {client ? 'Mettre à jour' : 'Enregistrer'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>

        <Modal
          opened={infoModalOpen}
          onClose={() => setInfoModalOpen(false)}
          title="📋 Instructions"
          size="sm"
          centered
          styles={{
            header: {
              backgroundColor: '#1b365d',
              padding: '10px 12px',
            },
            title: {
              color: 'white',
              fontWeight: 600,
              fontSize: 13,
            },
            body: {
              padding: '12px',
            },
          }}
        >
          <Stack gap="xs">
            <Text size="xs">1. Le code client est généré automatiquement</Text>
            <Text size="xs">2. Le nom complet est obligatoire</Text>
            <Text size="xs">3. Sélectionnez le type de client (Particulier, Revendeur, Entreprise)</Text>
            <Text size="xs">4. Les coordonnées sont optionnelles mais recommandées</Text>
            <Divider />
            <Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default FormulaireClient;