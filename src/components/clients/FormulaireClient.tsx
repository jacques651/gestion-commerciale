// src/components/clients/FormulaireClient.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, TextInput, Select, Button, Group, Stack,
  Paper, Text, ThemeIcon, Divider, SimpleGrid
} from '@mantine/core';
import {
  IconUser, IconBuildingStore, IconMapPin,
  IconPhone, IconMail, IconBuilding, IconUserPlus,
  IconEdit, IconDeviceFloppy, IconX, IconId
} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { Client } from '../../database/repositories/clientRepository';

interface FormulaireClientProps {
  onSuccess?: () => void;
  opened: boolean;
  onClose: () => void;
  editClient?: Client | null;
}

const EMPTY_FORM = {
  NomComplet: '',
  Societe: '',
  Adresse: '',
  adresse_postale: '',
  Tel: '',
  Email: '',
  Ville: '',
  TypeClient: 'client' as 'client' | 'revendeur',
  ifu: '',
  rccm: '',
};

export const FormulaireClient: React.FC<FormulaireClientProps> = ({ opened, onClose, editClient }) => {
  const { createClient, updateClient } = useClients();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (editClient) {
      setFormData({
        NomComplet: editClient.NomComplet || '',
        Societe: editClient.Societe || '',
        Adresse: editClient.Adresse || '',
        adresse_postale: editClient.adresse_postale || '',
        Tel: editClient.Tel || '',
        Email: editClient.Email || '',
        Ville: editClient.Ville || '',
        TypeClient: editClient.TypeClient || 'client',
        ifu: editClient.ifu || '',
        rccm: editClient.rccm || '',
      });
    } else if (opened) {
      setFormData(EMPTY_FORM);
    }
  }, [editClient, opened]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const clientData = {
        NomComplet: formData.NomComplet,
        Societe: formData.Societe || null,
        Adresse: formData.Adresse || null,
        adresse_postale: formData.adresse_postale || null,
        Tel: formData.Tel || null,
        Email: formData.Email || null,
        Ville: formData.Ville || null,
        TypeClient: formData.TypeClient,
        ifu: formData.ifu || null,
        rccm: formData.rccm || null,
      };
      if (editClient) {
        await updateClient(editClient.idClient, clientData);
      } else {
        await createClient(clientData);
      }
      onClose();
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const isEntreprise = formData.TypeClient === 'revendeur' || !!formData.Societe;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      padding={0}
      radius="lg"
      centered
      styles={{
        header: { backgroundColor: '#1a1a2e', padding: '20px 24px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
        title: { color: 'white', fontWeight: 700, fontSize: '1.2rem' },
        body: { padding: 0 }
      }}
      title={
        <Group gap="md">
          <ThemeIcon size="lg" radius="md" color="white" variant="light">
            {editClient ? <IconEdit size={20} /> : <IconUserPlus size={20} />}
          </ThemeIcon>
          <div>
            <Text size="lg" fw={700} c="white">
              {editClient ? 'Modifier le client' : 'Nouveau client'}
            </Text>
            <Text size="xs" opacity={0.7} c="white">
              {editClient ? 'Modifiez les informations du client' : "Ajoutez un nouveau client à votre carnet d'adresses"}
            </Text>
          </div>
        </Group>
      }
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="lg" p="xl">
          {/* Type */}
          <Paper className="tk-form-section" p="md" withBorder radius="md" style={{ backgroundColor: '#f8f9fa' }}>
            <Group gap="xs" mb="sm">
              <IconBuildingStore size={16} color="#4a6cf7" />
              <Text fw={600} size="sm" c="blue.5">Type de client</Text>
            </Group>
            <Select
              data={[
                { value: 'client', label: 'Client' },
                { value: 'revendeur', label: 'Revendeur' },
              ]}
              value={formData.TypeClient}
              onChange={(v) => setFormData({ ...formData, TypeClient: v as 'client' | 'revendeur' })}
              required size="md" styles={{ input: { backgroundColor: 'white' } }}
            />
          </Paper>

          <Divider label="Informations personnelles" labelPosition="center" />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput label="Nom complet" placeholder="Nom complet du client"
              value={formData.NomComplet} onChange={(e) => setFormData({ ...formData, NomComplet: e.target.value })}
              leftSection={<IconUser size={16} />} required size="md" />
            <TextInput label="Société" placeholder="Nom de la société (optionnel)"
              value={formData.Societe} onChange={(e) => setFormData({ ...formData, Societe: e.target.value })}
              leftSection={<IconBuilding size={16} />} size="md" />
          </SimpleGrid>

          <Divider label="Coordonnées" labelPosition="center" />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput label="Adresse géographique" placeholder="Quartier, rue..."
              value={formData.Adresse} onChange={(e) => setFormData({ ...formData, Adresse: e.target.value })}
              leftSection={<IconMapPin size={16} />} size="md" />
            <TextInput label="Adresse postale (BP)" placeholder="Ex : BP 1234 Ouagadougou"
              value={formData.adresse_postale} onChange={(e) => setFormData({ ...formData, adresse_postale: e.target.value })}
              leftSection={<IconMapPin size={16} />} size="md" />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput label="Ville" placeholder="Ville"
              value={formData.Ville} onChange={(e) => setFormData({ ...formData, Ville: e.target.value })}
              leftSection={<IconBuildingStore size={16} />} size="md" />
            <TextInput label="Téléphone" placeholder="Numéro de téléphone"
              value={formData.Tel} onChange={(e) => setFormData({ ...formData, Tel: e.target.value })}
              leftSection={<IconPhone size={16} />} size="md" />
          </SimpleGrid>

          <TextInput label="Email" placeholder="adresse@email.com"
            value={formData.Email} onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
            leftSection={<IconMail size={16} />} type="email" size="md" />

          {/* Champs fiscaux — toujours visibles (requis facture normalisée) */}
          <Divider label="Informations fiscales (facture normalisée)" labelPosition="center" />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput
              label={isEntreprise ? 'IFU (obligatoire — client pro)' : 'IFU'}
              placeholder="Identifiant Financier Unique"
              value={formData.ifu} onChange={(e) => setFormData({ ...formData, ifu: e.target.value })}
              leftSection={<IconId size={16} />} size="md"
            />
            <TextInput
              label={isEntreprise ? 'N° RCCM (obligatoire — client pro)' : 'N° RCCM'}
              placeholder="Registre du Commerce"
              value={formData.rccm} onChange={(e) => setFormData({ ...formData, rccm: e.target.value })}
              leftSection={<IconId size={16} />} size="md"
            />
          </SimpleGrid>

          <Divider />

          <Group justify="flex-end" gap="md">
            <Button variant="outline" onClick={onClose} leftSection={<IconX size={16} />} size="md">
              Annuler
            </Button>
            <Button type="submit" loading={loading} color={editClient ? 'blue' : 'green'}
              leftSection={<IconDeviceFloppy size={16} />} size="md">
              {editClient ? 'Enregistrer les modifications' : 'Créer le client'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default FormulaireClient;
