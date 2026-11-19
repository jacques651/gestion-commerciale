// src/components/parametres/ParametresTVA.tsx
import React, { useState, useEffect } from 'react';
import {
  Card, Switch, Text, Stack, Group, Button,
  NumberInput, Select, Alert, Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import { tvaService } from '../../services/tvaService';
import { configCommerceService } from '../../services/configCommerceService';


export const ParametresTVA: React.FC = () => {
  const [tvaActif, setTvaActif] = useState(true);
  const [tauxTVA, setTauxTVA] = useState<number | string>(18);
  const [commissionDefaut, setCommissionDefaut] = useState<number | string>(60);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await tvaService.get(true);
      setTvaActif(config.active);
      setTauxTVA(config.taux ?? 18);
      const taux = await configCommerceService.getCommissionDefaut();
      setCommissionDefaut(taux);
    } catch (error) {
      console.error('Erreur chargement config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Écrit dans TOUS les emplacements de stockage : la désactivation
      // s'applique désormais aux factures standards, reçus et ventes.
      await tvaService.set(
        tvaActif,
        typeof tauxTVA === 'string' ? parseFloat(tauxTVA) : tauxTVA
      );
      await configCommerceService.setCommissionDefaut(
        typeof commissionDefaut === 'string' ? parseFloat(commissionDefaut) || 0 : commissionDefaut
      );
      notifications.show({
        title: 'Succès',
        message: 'Configuration TVA enregistrée',
        color: 'green'
      });
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'enregistrement',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder shadow="sm" p="md" radius="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={600} size="lg">Configuration de la TVA</Text>
          <Switch
            label={tvaActif ? 'TVA activée' : 'TVA désactivée'}
            checked={tvaActif}
            onChange={(e) => setTvaActif(e.currentTarget.checked)}
            size="md"
            color={tvaActif ? 'green' : 'red'}
          />
        </Group>

        <Divider />

        {!tvaActif && (
          <Alert icon={<IconInfoCircle size={16} />} color="yellow">
            La TVA est actuellement désactivée. Les prix seront affichés hors taxe.
          </Alert>
        )}

        {tvaActif && (
          <>
            <NumberInput
              label="Taux de TVA par défaut (%)"
              value={tauxTVA}
              onChange={(val) => setTauxTVA(val ?? 0)}
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              size="md"
            />
            <Text size="sm" color="dimmed">
              Ce taux sera appliqué par défaut sur toutes les ventes.
              Vous pouvez le modifier individuellement sur chaque vente.
            </Text>
          </>
        )}

        <Divider label="Commission revendeurs" labelPosition="center" />
        <NumberInput
          label="Taux de commission par défaut (%)"
          description="Valeur proposée par défaut pour les revendeurs. 0 % est autorisé et respecté."
          value={commissionDefaut}
          onChange={(val) => setCommissionDefaut(val ?? 0)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          size="md"
        />

        <Group justify="flex-end">
          <Button
            variant="light"
            onClick={loadConfig}
            loading={loading}
          >
            Réinitialiser
          </Button>
          <Button
            onClick={handleSave}
            loading={loading}
          >
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};