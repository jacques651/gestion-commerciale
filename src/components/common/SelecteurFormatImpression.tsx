// src/components/common/SelecteurFormatImpression.tsx
import React, { useEffect, useState } from 'react';
import { Select, Group, SegmentedControl, Text } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import {
  FormatPapier,
  OrientationPapier,
  optionsFormatPapier,
  formatImpressionService,
} from '../../utils/printFormats';

interface Props {
  format: FormatPapier;
  onFormatChange: (format: FormatPapier) => void;
  orientation?: OrientationPapier;
  onOrientationChange?: (orientation: OrientationPapier) => void;
  /** Affiche le sélecteur d'orientation (défaut : true) */
  avecOrientation?: boolean;
  size?: 'xs' | 'sm' | 'md';
  label?: string;
}

/**
 * Sélecteur de format papier réutilisable, à placer dans toutes les boîtes
 * d'impression. Il est pré-rempli avec le format défini dans les Paramètres
 * et reste modifiable au coup par coup.
 */
export const SelecteurFormatImpression: React.FC<Props> = ({
  format,
  onFormatChange,
  orientation = 'portrait',
  onOrientationChange,
  avecOrientation = true,
  size = 'sm',
  label = 'Format d\'impression',
}) => (
  <Group gap="sm" align="flex-end" wrap="nowrap" className="no-print">
    <Select
      label={label}
      leftSection={<IconFileText size={16} />}
      data={optionsFormatPapier}
      value={format}
      onChange={(v) => v && onFormatChange(v as FormatPapier)}
      size={size}
      allowDeselect={false}
      style={{ minWidth: 210 }}
      comboboxProps={{ withinPortal: true }}
    />
    {avecOrientation && onOrientationChange && (
      <div>
        <Text size="xs" fw={500} mb={4}>Orientation</Text>
        <SegmentedControl
          size={size === 'md' ? 'sm' : 'xs'}
          value={orientation}
          onChange={(v) => onOrientationChange(v as OrientationPapier)}
          data={[
            { label: 'Portrait', value: 'portrait' },
            { label: 'Paysage', value: 'landscape' },
          ]}
        />
      </div>
    )}
  </Group>
);

/**
 * Hook compagnon : initialise le format avec la valeur par défaut des
 * Paramètres, tout en laissant l'utilisateur le changer pour l'impression
 * en cours.
 */
export const useFormatImpression = () => {
  const [format, setFormat] = useState<FormatPapier>('A4');
  const [orientation, setOrientation] = useState<OrientationPapier>('portrait');
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const [f, o] = await Promise.all([
          formatImpressionService.getFormatDefaut(),
          formatImpressionService.getOrientationDefaut(),
        ]);
        if (actif) {
          setFormat(f);
          setOrientation(o);
        }
      } catch (e) {
        console.error('Erreur chargement format d\'impression:', e);
      } finally {
        if (actif) setPret(true);
      }
    })();
    return () => { actif = false; };
  }, []);

  return { format, setFormat, orientation, setOrientation, pret };
};

export default SelecteurFormatImpression;
