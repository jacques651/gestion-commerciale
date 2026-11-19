// src/components/common/BandeauRestauration.tsx
// Premier lancement : base vide et ancienne base détectée → proposer la restauration (administrateur).
import { useEffect, useState } from 'react';
import { Alert, Button, Group, Text } from '@mantine/core';
import { IconDatabaseImport } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTransactionContext } from '../../hooks/useTransactionSnapshot';
import { restaurationService, restaurationDisponible, resumeContenu, type AncienneBase } from '../../services/restaurationService';

const CLE_MASQUE = 'tk-restauration-plus-tard';

export default function BandeauRestauration() {
  const ctx = useTransactionContext();
  const navigate = useNavigate();
  const [trouvee, setTrouvee] = useState<AncienneBase | null>(null);
  const [masque, setMasque] = useState<boolean>(() => {
    try { return sessionStorage.getItem(CLE_MASQUE) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (!restaurationDisponible() || !ctx || String(ctx.role).toLowerCase() !== 'admin' || masque) return;
    let actif = true;
    restaurationService.etat(ctx)
      .then((etat) => {
        const candidat = etat.baseVide ? etat.candidats.find((c) => c.valide && !c.vide) : undefined;
        if (actif) setTrouvee(candidat ?? null);
      })
      .catch(() => { /* silencieux : la carte des Paramètres affiche l'erreur */ });
    return () => { actif = false; };
  }, [ctx, masque]);

  if (!trouvee || masque) return null;

  const plusTard = () => {
    try { sessionStorage.setItem(CLE_MASQUE, '1'); } catch { /* ignore */ }
    setMasque(true);
  };

  return (
    <Alert color="teal" variant="light" icon={<IconDatabaseImport size={18} />} mb="md"
      title="Des données de l'ancienne version ont été trouvées sur ce PC">
      <Text size="sm" mb="sm">
        La base actuelle est vide. Ancienne base : {resumeContenu(trouvee.compteurs)}.
      </Text>
      <Group gap="xs">
        <Button size="xs" onClick={() => navigate('/parametres#restauration')}>Voir et restaurer</Button>
        <Button size="xs" variant="default" onClick={plusTard}>Plus tard</Button>
      </Group>
    </Alert>
  );
}
