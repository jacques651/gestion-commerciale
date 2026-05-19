// src/components/clients/FormulaireClient.tsx
import React, { useState, useEffect } from 'react';
import { Modal, TextInput, Select, Button, Group, Stack } from '@mantine/core';
import { useClients } from '../../hooks/useClients';
import { Client } from '../../database/repositories/clientRepository';

interface FormulaireClientProps {
  opened: boolean;
  onClose: () => void;
  editClient?: Client | null;
}

export const FormulaireClient: React.FC<FormulaireClientProps> = ({ opened, onClose, editClient }) => {
  const { createClient, updateClient } = useClients();
  const [loading, setLoading] = useState(false);

  // Ces champs correspondent EXACTEMENT à la nouvelle table
  const [formData, setFormData] = useState({
    NomComplet: '',
    Societe: '',
    Adresse: '',
    Tel: '',
    Email: '',
    Ville: '',
    TypeClient: 'client' as 'client' | 'revendeur',
  });

  // Remplir le formulaire si édition
  useEffect(() => {
    if (editClient) {
      setFormData({
        NomComplet: editClient.NomComplet || '',
        Societe: editClient.Societe || '',
        Adresse: editClient.Adresse || '',
        Tel: editClient.Tel || '',
        Email: editClient.Email || '',
        Ville: editClient.Ville || '',
        TypeClient: editClient.TypeClient || 'client',
      });
    } else if (opened) {
      // Réinitialiser pour un nouveau client
      setFormData({
        NomComplet: '',
        Societe: '',
        Adresse: '',
        Tel: '',
        Email: '',
        Ville: '',
        TypeClient: 'client',
      });
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
        Tel: formData.Tel || null,
        Email: formData.Email || null,
        Ville: formData.Ville || null,
        TypeClient: formData.TypeClient,
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

  const typeOptions = [
    { value: 'client', label: 'Client' },
    { value: 'revendeur', label: 'Revendeur' },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editClient ? 'Modifier le client' : 'Nouveau client'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Nom complet"
            placeholder="Nom complet du client"
            value={formData.NomComplet}
            onChange={(e) => setFormData({ ...formData, NomComplet: e.target.value })}
            required
          />

          <TextInput
            label="Société"
            placeholder="Nom de la société (optionnel)"
            value={formData.Societe}
            onChange={(e) => setFormData({ ...formData, Societe: e.target.value })}
          />

          <TextInput
            label="Adresse"
            placeholder="Adresse complète"
            value={formData.Adresse}
            onChange={(e) => setFormData({ ...formData, Adresse: e.target.value })}
          />

          <TextInput
            label="Téléphone"
            placeholder="Numéro de téléphone"
            value={formData.Tel}
            onChange={(e) => setFormData({ ...formData, Tel: e.target.value })}
          />

          <TextInput
            label="Email"
            placeholder="adresse@email.com"
            value={formData.Email}
            onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
            type="email"
          />

          <TextInput
            label="Ville"
            placeholder="Ville"
            value={formData.Ville}
            onChange={(e) => setFormData({ ...formData, Ville: e.target.value })}
          />

          <Select
            label="Type de client"
            placeholder="Sélectionner le type"
            data={typeOptions}
            value={formData.TypeClient}
            onChange={(value) => setFormData({ ...formData, TypeClient: value as 'client' | 'revendeur' })}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={loading}>
              {editClient ? 'Modifier' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};