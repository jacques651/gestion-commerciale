// src/components/parametres/RestaurationAncienneBase.tsx
// Paramètres : restaurer la base de données de l'ancienne version (GestionPro.exe uniquement).
import { useCallback, useEffect, useState } from 'react';
import { Card, Title, Text, Table, Button, Group, Badge, Alert, Modal, Stack, Loader } from '@mantine/core';
import { IconDatabaseImport, IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { useTransactionContext } from '../../hooks/useTransactionSnapshot';
import {
  restaurationService, restaurationDisponible, resumeContenu, tailleLisible, dateLisible,
  type AncienneBase,
} from '../../services/restaurationService';

export default function RestaurationAncienneBase() {
  const ctx = useTransactionContext();
  const { logout } = useAuth();
  const [candidats, setCandidats] = useState<AncienneBase[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choix, setChoix] = useState<AncienneBase | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    if (!ctx) return;
    setChargement(true); setErreur(null);
    try { setCandidats((await restaurationService.etat(ctx)).candidats); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Recherche impossible.'); }
    finally { setChargement(false); }
  }, [ctx]);

  useEffect(() => { if (restaurationDisponible()) charger(); }, [charger]);

  // Arrivée depuis le bandeau du premier lancement : amener la carte à l'écran.
  useEffect(() => {
    if (!chargement && window.location.hash === '#restauration') {
      document.getElementById('restauration')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [chargement]);

  if (!restaurationDisponible()) return null;

  const restaurer = async () => {
    if (!choix || !ctx || enCours) return;
    setEnCours(true);
    try {
      const resultat = await restaurationService.appliquer(choix.id, ctx);
      notifications.show({
        color: 'green', title: 'Base restaurée',
        message: `${resumeContenu(resultat.compteurs)}. Reconnectez-vous.`,
      });
      logout();
      window.location.assign('/');
    } catch (e) {
      notifications.show({ color: 'red', title: 'Restauration impossible', message: e instanceof Error ? e.message : 'Erreur inconnue.' });
      setEnCours(false);
    }
  };

  return (
    <Card withBorder radius="lg" p="lg" id="restauration">
      <Group justify="space-between" mb="xs">
        <Title order={4} className="tk-card-title">Restaurer l'ancienne base</Title>
        <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={charger} loading={chargement}>
          Rechercher
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Bases de données de l'ancienne version trouvées sur ce PC. La base actuelle est sauvegardée avant d'être remplacée.
      </Text>

      {erreur && <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md">{erreur}</Alert>}

      {chargement ? (
        <Group justify="center" p="md"><Loader size="sm" /></Group>
      ) : candidats.length === 0 ? (
        !erreur && <Text size="sm">Aucune base de l'ancienne version n'a été trouvée sur ce PC.</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Emplacement</Table.Th>
              <Table.Th>Dernière modification</Table.Th>
              <Table.Th>Taille</Table.Th>
              <Table.Th>Contenu</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {candidats.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td style={{ wordBreak: 'break-all' }}>{c.chemin}</Table.Td>
                <Table.Td>{dateLisible(c.modifie)}</Table.Td>
                <Table.Td>{tailleLisible(c.taille)}</Table.Td>
                <Table.Td>
                  {c.valide ? resumeContenu(c.compteurs) : <Badge color="red" variant="light">{c.erreur ?? 'Invalide'}</Badge>}
                </Table.Td>
                <Table.Td>
                  <Button size="xs" leftSection={<IconDatabaseImport size={14} />}
                    disabled={!c.valide || c.vide} onClick={() => setChoix(c)}>
                    Restaurer
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={!!choix} onClose={() => !enCours && setChoix(null)} title="Restaurer l'ancienne base" centered>
        {choix && (
          <Stack gap="sm">
            <Text size="sm">Base de l'ancienne version : <b>{choix.chemin}</b></Text>
            <Text size="sm">Contenu : {resumeContenu(choix.compteurs)} (modifiée le {dateLisible(choix.modifie)}).</Text>
            <Alert color="orange" icon={<IconAlertCircle size={16} />}>
              Les données actuelles seront remplacées par celles de l'ancienne version. Une sauvegarde complète
              de la base actuelle est faite avant, dans data\sauvegardes-restauration. Tous les postes
              devront se reconnecter.
            </Alert>
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setChoix(null)} disabled={enCours}>Annuler</Button>
              <Button color="red" onClick={restaurer} loading={enCours}>Restaurer</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Card>
  );
}
