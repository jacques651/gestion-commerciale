// src/components/pages/SecondeMain.tsx
// Gestion des articles de seconde main (téléphones d'occasion) :
// génération d'une attestation d'achat-vente avec décharge intégrée.
import React, { useState } from 'react';
import { Box, Card, Stack, Text, Button, Group, ThemeIcon, Title, List } from '@mantine/core';
import { IconDeviceMobile, IconFileText, IconShieldCheck } from '@tabler/icons-react';
import AttestationOccasion from '../ventes/AttestationOccasion';
import ListeAttestations from '../ventes/ListeAttestations';

const SecondeMain: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(0);

  return (
    <Box p="md">
      <Card className="tk-page-tools" withBorder radius="md" p="lg" mb="md">
        <Group justify="space-between" wrap="nowrap">
          <Group>
            <ThemeIcon size="xl" radius="md" variant="light" color="grape">
              <IconDeviceMobile size={26} />
            </ThemeIcon>
            <div>
              <Title order={3} c="white">Articles de seconde main</Title>
              <Text c="rgba(255,255,255,0.7)" size="sm">
                Attestation d'achat-vente pour téléphones et matériels d'occasion
              </Text>
            </div>
          </Group>
          <Button size="md" color="grape" leftSection={<IconFileText size={18} />} onClick={() => setOpen(true)}>
            Nouvelle attestation
          </Button>
        </Group>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group gap="xs" mb="sm">
          <IconShieldCheck size={18} />
          <Text fw={600}>À propos de l'attestation d'achat-vente</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="sm">
          Ce document officialise l'acquisition ou la cession d'un appareil d'occasion.
          Il comprend :
        </Text>
        <List size="sm" spacing={4}>
          <List.Item>l'identité du cédant et du cessionnaire (nom, domicile, téléphone, pièce d'identité) ;</List.Item>
          <List.Item>la description du matériel (marque, modèle, IMEI, état) ;</List.Item>
          <List.Item>le montant de la transaction ;</List.Item>
          <List.Item>une <b>clause de décharge</b> et les signatures « lu et approuvé ».</List.Item>
        </List>
        <Button mt="lg" variant="light" color="grape" leftSection={<IconFileText size={16} />} onClick={() => setOpen(true)}>
          Créer une attestation
        </Button>
      </Card>

      {/* Liste des attestations enregistrées : tri par date, filtres, imprimer / PDF / annuler */}
      <ListeAttestations reloadSignal={reloadSignal} />

      <AttestationOccasion opened={open} onClose={() => setOpen(false)} vente={null} onSaved={() => setReloadSignal((v) => v + 1)} />
    </Box>
  );
};

export default SecondeMain;
