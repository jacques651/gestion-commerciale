// src/components/common/ModalParametres.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Text,
  Divider,
  NumberInput,
  Textarea,
  Alert,
  LoadingOverlay,
  SimpleGrid,
  Card,
  Select
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBuildingStore, IconCheck, IconX } from '@tabler/icons-react';
import { userService, CompanySettings } from '../../services/userService';

interface ModalParametresProps {
  opened: boolean;
  onClose: () => void;
}

export const ModalParametres: React.FC<ModalParametresProps> = ({ opened, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [, setSettings] = useState<CompanySettings | null>(null);
  const [formData, setFormData] = useState({
    nom_entreprise: '',
    telephone: '',
    email: '',
    adresse: '',
    nif: '',
    rccm: '',
    devise: 'FCFA',
    taux_tva: 18,
    message_facture: ''
  });

  useEffect(() => {
    if (opened) {
      loadSettings();
    }
  }, [opened]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await userService.getCompanySettings();
      setSettings(data);
      if (data) {
        setFormData({
          nom_entreprise: data.nom_entreprise || '',
          telephone: data.telephone || '',
          email: data.email || '',
          adresse: data.adresse || '',
          nif: data.nif || '',
          rccm: data.rccm || '',
          devise: data.devise || 'FCFA',
          taux_tva: data.taux_tva || 18,
          message_facture: data.message_facture || ''
        });
      }
    } catch (error) {
      console.error('Erreur chargement paramètres:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    setLoading(true);
    try {
      const success = await userService.updateCompanySettings({
        nom_entreprise: formData.nom_entreprise,
        telephone: formData.telephone,
        email: formData.email,
        adresse: formData.adresse,
        nif: formData.nif,
        message_facture: formData.message_facture
      });
      
      if (success) {
        notifications.show({
          title: '✅ Succès',
          message: 'Paramètres mis à jour avec succès',
          color: 'green'
        });
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconBuildingStore size={24} color="#228be6" />
          <Text fw={700} size="lg">Paramètres de l'entreprise</Text>
        </Group>
      }
      size="xl"
      centered
      padding="lg"
    >
      <LoadingOverlay visible={loading} />
      
      <Stack gap="md">
        <Alert color="blue" variant="light">
          <Text size="sm" fw={500}>Informations de l'entreprise</Text>
          <Text size="xs">Ces informations apparaîtront sur les factures et documents officiels</Text>
        </Alert>
        
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Nom de l'entreprise"
            placeholder="Votre entreprise"
            value={formData.nom_entreprise}
            onChange={(e) => setFormData({ ...formData, nom_entreprise: e.target.value })}
            required
          />
          
          <TextInput
            label="Téléphone"
            placeholder="+225 XX XX XX XX"
            value={formData.telephone}
            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
          />
          
          <TextInput
            label="Email"
            placeholder="contact@entreprise.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            type="email"
          />
          
          <TextInput
            label="NIF (Numéro d'Identification Fiscale)"
            placeholder="NIF"
            value={formData.nif}
            onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
          />
        </SimpleGrid>
        
        <TextInput
          label="Adresse"
          placeholder="Adresse complète"
          value={formData.adresse}
          onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
        />
        
        <Divider label="Paramètres financiers" labelPosition="center" />
        
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select
            label="Devise"
            value={formData.devise}
            onChange={(value) => setFormData({ ...formData, devise: value || 'FCFA' })}
            data={[
              { value: 'FCFA', label: 'Franc CFA (FCFA)' },
              { value: 'EUR', label: 'Euro (€)' },
              { value: 'USD', label: 'Dollar ($)' }
            ]}
          />
          
          <NumberInput
            label="Taux TVA (%)"
            value={formData.taux_tva}
            onChange={(value) => setFormData({ ...formData, taux_tva: Number(value) || 0 })}
            min={0}
            max={50}
            step={1}
          />
        </SimpleGrid>
        
        <Divider label="Personnalisation" labelPosition="center" />
        
        <Textarea
          label="Message sur les factures"
          placeholder="Merci de votre confiance..."
          value={formData.message_facture}
          onChange={(e) => setFormData({ ...formData, message_facture: e.target.value })}
          rows={3}
          description="Ce message apparaîtra au bas des factures"
        />
        
        <Divider />
        
        {/* Aperçu des informations */}
        <Card withBorder p="sm" bg="gray.0">
          <Text fw={600} size="sm" mb="xs">📄 Aperçu des informations</Text>
          <SimpleGrid cols={2} spacing="xs">
            <Text size="xs" c="dimmed">Entreprise:</Text>
            <Text size="xs" fw={500}>{formData.nom_entreprise || 'Non renseigné'}</Text>
            <Text size="xs" c="dimmed">TVA:</Text>
            <Text size="xs">{formData.taux_tva}%</Text>
            <Text size="xs" c="dimmed">Devise:</Text>
            <Text size="xs">{formData.devise}</Text>
          </SimpleGrid>
        </Card>
        
        {/* Boutons action */}
        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose} leftSection={<IconX size={16} />}>
            Annuler
          </Button>
          <Button onClick={handleUpdateSettings} color="green" leftSection={<IconCheck size={16} />}>
            Enregistrer les paramètres
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};