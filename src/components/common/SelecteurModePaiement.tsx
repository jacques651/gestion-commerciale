// src/components/common/SelecteurModePaiement.tsx
// Sélecteur réutilisable de moyen de paiement, alimenté par le référentiel
// `moyens_paiement` (Espèces, Orange/Moov/Télétel/Wave/Sank Money, Virement,
// Chèque, + modes « Autre » saisis par l'opérateur et mémorisés).
//
// Le composant renvoie le moyen complet (code, libellé, catégorie). La
// catégorie pilote la ventilation espèces/transferts de la caisse ; le libellé
// est conservé pour l'affichage et les rapports.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Select, TextInput, Button, Group, Stack, Text } from '@mantine/core';
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  journalCaisseService,
  MoyenPaiement,
  ModePaiement,
} from '../../services/journalCaisseService';

const NOUVEAU = '__NOUVEAU_MOYEN__';

const GROUPES: { categorie: ModePaiement; label: string }[] = [
  { categorie: 'ESPECES', label: 'Espèces' },
  { categorie: 'MOBILE_MONEY', label: 'Mobile Money' },
  { categorie: 'VIREMENT', label: 'Virement' },
  { categorie: 'CHEQUE', label: 'Chèque' },
  { categorie: 'AUTRE', label: 'Autres' },
];

interface Props {
  /** Code du moyen sélectionné (contrôlé par le parent). */
  value?: string | null;
  /** Appelé avec le moyen complet sélectionné (ou null). */
  onChange: (moyen: MoyenPaiement | null) => void;
  label?: string;
  placeholder?: string;
  size?: string;
  required?: boolean;
  withAsterisk?: boolean;
  disabled?: boolean;
  /** Valeur par défaut si aucune sélection (par code). Défaut : ESPECES. */
  defaultCode?: string;
}

export const SelecteurModePaiement: React.FC<Props> = ({
  value,
  onChange,
  label = 'Mode de paiement',
  placeholder = 'Choisissez un mode',
  size = 'sm',
  required,
  withAsterisk,
  disabled,
  defaultCode = 'ESPECES',
}) => {
  const [moyens, setMoyens] = useState<MoyenPaiement[]>([]);
  const [selection, setSelection] = useState<string | null>(value ?? null);
  const [saisieOuverte, setSaisieOuverte] = useState(false);
  const [nouveauLibelle, setNouveauLibelle] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const initialise = useRef(false);

  const charger = async (selectionner?: string) => {
    const liste = await journalCaisseService.getMoyensPaiement();
    setMoyens(liste);
    return liste;
  };

  // Chargement initial + sélection par défaut si le parent n'impose rien.
  useEffect(() => {
    (async () => {
      const liste = await charger();
      if (!initialise.current) {
        initialise.current = true;
        if (!value) {
          const def = liste.find((m) => m.code === defaultCode) || liste[0];
          if (def) {
            setSelection(def.code);
            onChange(def);
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronisation si le parent change la valeur.
  useEffect(() => {
    if (value !== undefined && value !== selection) setSelection(value ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const data = useMemo(() => {
    const groupes = GROUPES.map((g) => ({
      group: g.label,
      items: moyens
        .filter((m) => m.categorie === g.categorie)
        .map((m) => ({ value: m.code, label: m.libelle })),
    })).filter((g) => g.items.length > 0);
    // Option pour créer un nouveau moyen.
    groupes.push({
      group: 'Ajouter',
      items: [{ value: NOUVEAU, label: '＋ Autre (préciser)…' }],
    });
    return groupes;
  }, [moyens]);

  const handleSelect = (val: string | null) => {
    if (val === NOUVEAU) {
      setSaisieOuverte(true);
      setNouveauLibelle('');
      return;
    }
    setSaisieOuverte(false);
    setSelection(val);
    const moyen = moyens.find((m) => m.code === val) || null;
    onChange(moyen);
  };

  const enregistrerNouveau = async () => {
    const nom = nouveauLibelle.trim();
    if (!nom) return;
    setEnregistrement(true);
    try {
      // Un mode saisi librement est classé « Autre » (compté hors espèces).
      const moyen = await journalCaisseService.ajouterMoyenPaiement(nom, 'AUTRE');
      await charger();
      setSelection(moyen.code);
      onChange(moyen);
      setSaisieOuverte(false);
      setNouveauLibelle('');
      notifications.show({
        title: 'Moyen ajouté',
        message: `« ${moyen.libelle} » est désormais disponible dans la liste.`,
        color: 'green',
      });
    } catch (e: any) {
      notifications.show({
        title: 'Erreur',
        message: e?.message || "Impossible d'ajouter ce moyen de paiement.",
        color: 'red',
      });
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <Stack gap={6}>
      <Select
        label={label}
        placeholder={placeholder}
        data={data as any}
        value={selection}
        onChange={handleSelect}
        allowDeselect={false}
        searchable
        size={size}
        required={required}
        withAsterisk={withAsterisk}
        disabled={disabled}
        comboboxProps={{ withinPortal: true }}
      />

      {saisieOuverte && (
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            size={size}
            label="Nouveau moyen de paiement"
            placeholder="Ex. : Carte bancaire, Coris Money…"
            value={nouveauLibelle}
            onChange={(e) => setNouveauLibelle(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enregistrerNouveau(); } }}
            data-autofocus
          />
          <Button size={size} onClick={enregistrerNouveau} loading={enregistrement}
            leftSection={<IconCheck size={14} />} disabled={!nouveauLibelle.trim()}>
            Ajouter
          </Button>
          <Button size={size} variant="subtle" color="gray" onClick={() => setSaisieOuverte(false)}
            leftSection={<IconX size={14} />}>
            Annuler
          </Button>
        </Group>
      )}
      {saisieOuverte && (
        <Text size="xs" c="dimmed">
          <IconPlus size={11} style={{ verticalAlign: -1 }} /> Ce mode sera mémorisé et proposé les prochaines fois (compté hors espèces).
        </Text>
      )}
    </Stack>
  );
};

export default SelecteurModePaiement;
