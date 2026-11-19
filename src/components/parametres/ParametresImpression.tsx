// src/components/parametres/ParametresImpression.tsx
import React, { useEffect, useState } from 'react';
import { Card, Stack, Group, Text, Button, Divider, Alert, Select, SegmentedControl } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconPrinter, IconDeviceFloppy } from '@tabler/icons-react';
import {
  FormatPapier,
  OrientationPapier,
  optionsFormatPapier,
  getDefinitionFormat,
  formatImpressionService,
} from '../../utils/printFormats';

/**
 * Paramètres d'impression : définit le format papier par défaut appliqué à
 * tous les documents (factures, reçus, journaux, rapports).
 * Ce choix reste modifiable au moment de chaque impression.
 */
export const ParametresImpression: React.FC = () => {
  const [format, setFormat] = useState<FormatPapier>('A4');
  const [orientation, setOrientation] = useState<OrientationPapier>('portrait');
  const [loading, setLoading] = useState(false);

  const charger = async () => {
    try {
      const [f, o] = await Promise.all([
        formatImpressionService.getFormatDefaut(true),
        formatImpressionService.getOrientationDefaut(),
      ]);
      setFormat(f);
      setOrientation(o);
    } catch (error) {
      console.error('Erreur chargement paramètres d\'impression:', error);
    }
  };

  useEffect(() => { charger(); }, []);

  const enregistrer = async () => {
    setLoading(true);
    try {
      await formatImpressionService.setFormatDefaut(format);
      await formatImpressionService.setOrientationDefaut(orientation);
      notifications.show({
        title: 'Succès',
        message: 'Format d\'impression par défaut enregistré',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible d\'enregistrer le format d\'impression',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const def = getDefinitionFormat(format);
  const largeur = orientation === 'landscape' ? def.hauteurMm : def.largeurMm;
  const hauteur = orientation === 'landscape' ? def.largeurMm : def.hauteurMm;

  return (
    <Card withBorder shadow="sm" p="md" radius="md">
      <Stack>
        <Group justify="space-between">
          <Group gap="xs">
            <IconPrinter size={20} />
            <Text fw={600} size="lg">Format d'impression</Text>
          </Group>
        </Group>

        <Divider />

        <Alert icon={<IconInfoCircle size={16} />} color="blue">
          Ce format est appliqué par défaut à tous les documents imprimés.
          Il reste modifiable au moment de chaque impression. Le contenu
          (police, marges, tableaux) s'adapte automatiquement au format choisi.
        </Alert>

        <Select
          label="Format papier par défaut"
          description="Utilisé pour les factures, reçus, journaux de caisse et rapports"
          data={optionsFormatPapier}
          value={format}
          onChange={(v) => v && setFormat(v as FormatPapier)}
          allowDeselect={false}
          size="md"
        />

        <div>
          <Text size="sm" fw={500} mb={4}>Orientation par défaut</Text>
          <SegmentedControl
            value={orientation}
            onChange={(v) => setOrientation(v as OrientationPapier)}
            data={[
              { label: 'Portrait', value: 'portrait' },
              { label: 'Paysage', value: 'landscape' },
            ]}
          />
        </div>

        {/* Aperçu des dimensions retenues */}
        <Card withBorder bg="gray.0" p="sm">
          <Text size="sm" c="dimmed">
            Dimensions : <strong>{largeur} × {hauteur} mm</strong> ·
            Marges : <strong>{def.margeMm} mm</strong> ·
            Police de base : <strong>{def.policeBasePt} pt</strong>
          </Text>
        </Card>

        <Group justify="flex-end">
          <Button variant="light" onClick={charger}>Réinitialiser</Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={enregistrer}
            loading={loading}
          >
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};

export default ParametresImpression;
