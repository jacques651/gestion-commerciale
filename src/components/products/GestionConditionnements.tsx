// src/components/products/GestionConditionnements.tsx
import React, { useState, useEffect } from 'react';
import { confirm } from '../../utils/confirm';
import {
  Stack,
  Title,
  Text,
  Group,
  Button,
  Table,
  Badge,
  ActionIcon,
  Modal,
  NumberInput,
  TextInput,
  Divider,
  Tooltip,
  Card,
  ScrollArea,
  Switch,
  Alert,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconBoxMultiple,
  IconStar,
  IconStarFilled,
  IconInfoCircle,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';

interface Conditionnement {
  idConditionnement: number;
  idProduit: number;
  code_conditionnement: string;
  libelle: string;
  quantite_par_unite_base: number;
  prix_vente_ttc: number;
  prix_vente_ht: number;
  est_conditionnement_par_defaut: number;
  est_actif: number;
}

interface GestionConditionnementsProps {
  idProduit: number;
  uniteBase?: string; // ex: "pièce", "kg", "litre"
}

const GestionConditionnements: React.FC<GestionConditionnementsProps> = ({
  idProduit,
  uniteBase = 'pièce',
}) => {
  const [conditionnements, setConditionnements] = useState<Conditionnement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conditionnement | null>(null);
  const [formData, setFormData] = useState({
    libelle: '',
    quantite_par_unite_base: 1,
    prix_vente_ttc: 0,
    est_conditionnement_par_defaut: false,
  });

  const loadConditionnements = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const result = await db.select<Conditionnement[]>(`
        SELECT * FROM conditionnements
        WHERE idProduit = ? AND est_actif = 1
        ORDER BY est_conditionnement_par_defaut DESC, quantite_par_unite_base ASC
      `, [idProduit]);
      setConditionnements(result);
    } catch (error) {
      console.error('Erreur chargement conditionnements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idProduit) {
      loadConditionnements();
    }
  }, [idProduit]);

  const openModal = (cond?: Conditionnement) => {
    if (cond) {
      setEditing(cond);
      setFormData({
        libelle: cond.libelle,
        quantite_par_unite_base: cond.quantite_par_unite_base,
        prix_vente_ttc: cond.prix_vente_ttc,
        est_conditionnement_par_defaut: cond.est_conditionnement_par_defaut === 1,
      });
    } else {
      setEditing(null);
      setFormData({
        libelle: '',
        quantite_par_unite_base: 1,
        prix_vente_ttc: 0,
        est_conditionnement_par_defaut: conditionnements.length === 0,
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormData({ libelle: '', quantite_par_unite_base: 1, prix_vente_ttc: 0, est_conditionnement_par_defaut: false });
  };

  const handleSave = async () => {
    if (!formData.libelle.trim()) {
      alert('Veuillez saisir un libellé (ex: Boîte, Paquet, Carton...)');
      return;
    }
    if (formData.quantite_par_unite_base < 1) {
      alert('La quantité doit être au moins 1');
      return;
    }
    if (formData.prix_vente_ttc < 0) {
      alert('Le prix doit être positif');
      return;
    }

    try {
      const db = await getDb();
      const isDefault = formData.est_conditionnement_par_defaut ? 1 : 0;

      // Si ce conditionnement devient défaut, retirer l'ancien défaut
      if (isDefault) {
        await db.execute(
          `UPDATE conditionnements SET est_conditionnement_par_defaut = 0 WHERE idProduit = ?`,
          [idProduit]
        );
      }

      if (editing) {
        await db.execute(`
          UPDATE conditionnements
          SET libelle = ?,
              quantite_par_unite_base = ?,
              prix_vente_ttc = ?,
              prix_vente_ht = ?,
              est_conditionnement_par_defaut = ?
          WHERE idConditionnement = ?
        `, [
          formData.libelle.trim(),
          formData.quantite_par_unite_base,
          formData.prix_vente_ttc,
          formData.prix_vente_ttc,
          isDefault,
          editing.idConditionnement,
        ]);
      } else {
        const code = `COND-${Date.now()}`;
        await db.execute(`
          INSERT INTO conditionnements
            (idProduit, code_conditionnement, libelle, quantite_par_unite_base,
             prix_vente_ttc, prix_vente_ht, est_conditionnement_par_defaut, est_actif)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          idProduit,
          code,
          formData.libelle.trim(),
          formData.quantite_par_unite_base,
          formData.prix_vente_ttc,
          formData.prix_vente_ttc,
          isDefault,
        ]);
      }

      closeModal();
      loadConditionnements();
    } catch (error) {
      console.error('Erreur sauvegarde conditionnement:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleToggleDefault = async (cond: Conditionnement) => {
    try {
      const db = await getDb();
      await db.execute(
        `UPDATE conditionnements SET est_conditionnement_par_defaut = 0 WHERE idProduit = ?`,
        [idProduit]
      );
      await db.execute(
        `UPDATE conditionnements SET est_conditionnement_par_defaut = 1 WHERE idConditionnement = ?`,
        [cond.idConditionnement]
      );
      loadConditionnements();
    } catch (error) {
      console.error('Erreur toggle défaut:', error);
    }
  };

  const handleDelete = async (id: number, libelle: string) => {
    if (!await confirm(`Supprimer le conditionnement "${libelle}" ?`, 'Suppression')) return;
    try {
      const db = await getDb();
      await db.execute('DELETE FROM conditionnements WHERE idConditionnement = ?', [id]);
      loadConditionnements();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const prixParUnite = (prixTtc: number, qte: number): string => {
    if (!qte) return '—';
    return Math.round(prixTtc / qte).toLocaleString('fr-FR');
  };

  if (loading) {
    return (
      <Card withBorder p="sm">
        <Text size="sm" ta="center" c="dimmed">Chargement des conditionnements...</Text>
      </Card>
    );
  }

  return (
    <Card withBorder p="sm" radius="md">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconBoxMultiple size={18} color="var(--mantine-color-blue-6)" />
          <Title order={6}>Conditionnements</Title>
          {conditionnements.length > 0 && (
            <Badge size="xs" variant="light" color="blue" radius="xl">
              {conditionnements.length}
            </Badge>
          )}
        </Group>
        <Button
          size="xs"
          leftSection={<IconPlus size={12} />}
          onClick={() => openModal()}
          variant="light"
        >
          Ajouter
        </Button>
      </Group>

      <Divider mb="sm" />

      {conditionnements.length === 0 ? (
        <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light" py="sm">
          <Text size="xs">
            Aucun conditionnement. Ajoutez des unités de vente (Boîte, Carton, Sachet...)
            indiquant combien de {uniteBase}s elles contiennent.
          </Text>
        </Alert>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover style={{ minWidth: 440 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 30 }}></Table.Th>
                <Table.Th style={{ whiteSpace: 'nowrap' }}>Libellé</Table.Th>
                <Table.Th style={{ whiteSpace: 'nowrap' }}>Contenu</Table.Th>
                <Table.Th style={{ whiteSpace: 'nowrap' }}>Prix vente</Table.Th>
                <Table.Th style={{ whiteSpace: 'nowrap' }}>Prix / {uniteBase}</Table.Th>
                <Table.Th style={{ width: 70 }}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {conditionnements.map((c) => (
                <Table.Tr key={c.idConditionnement}>
                  <Table.Td>
                    <Tooltip label={c.est_conditionnement_par_defaut ? 'Conditionnement par défaut' : 'Définir comme défaut'}>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color={c.est_conditionnement_par_defaut ? 'yellow' : 'gray'}
                        onClick={() => handleToggleDefault(c)}
                      >
                        {c.est_conditionnement_par_defaut
                          ? <IconStarFilled size={14} />
                          : <IconStar size={14} />
                        }
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Badge
                      color={c.est_conditionnement_par_defaut ? 'yellow' : 'blue'}
                      variant="light"
                      size="sm"
                    >
                      {c.libelle}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Text size="sm">
                      1 {c.libelle} = <strong>{c.quantite_par_unite_base}</strong>{' '}
                      {uniteBase}{c.quantite_par_unite_base > 1 ? 's' : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {c.prix_vente_ttc.toLocaleString('fr-FR')} F
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Badge color="green" variant="light" size="xs">
                      {prixParUnite(c.prix_vente_ttc, c.quantite_par_unite_base)} F/{uniteBase}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="center">
                      <Tooltip label="Modifier">
                        <ActionIcon size="sm" color="orange" variant="subtle" onClick={() => openModal(c)}>
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon size="sm" color="red" variant="subtle" onClick={() => handleDelete(c.idConditionnement, c.libelle)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={
          <Group gap="xs">
            <IconBoxMultiple size={18} />
            <Text fw={600}>{editing ? 'Modifier le conditionnement' : 'Nouveau conditionnement'}</Text>
          </Group>
        }
        size="sm"
        centered
        padding="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Libellé"
            placeholder="Ex: Boîte, Carton, Sachet, Lot de 6..."
            value={formData.libelle}
            onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
            size="sm"
            required
            description="Nom affiché lors de la vente"
          />
          <NumberInput
            label={`Quantité en ${uniteBase}s`}
            description={`Combien de ${uniteBase}s contient ce conditionnement ?`}
            placeholder="Ex: 12, 24, 100..."
            value={formData.quantite_par_unite_base}
            onChange={(val) => setFormData({ ...formData, quantite_par_unite_base: Number(val) || 1 })}
            min={1}
            size="sm"
            required
          />
          {formData.quantite_par_unite_base > 1 && formData.libelle && (
            <Alert color="blue" variant="light" py="xs">
              <Text size="xs">
                1 {formData.libelle} = <strong>{formData.quantite_par_unite_base}</strong>{' '}
                {uniteBase}{formData.quantite_par_unite_base > 1 ? 's' : ''}
              </Text>
            </Alert>
          )}
          <NumberInput
            label="Prix de vente (FCFA)"
            description={`Prix pour 1 ${formData.libelle || 'conditionnement'}`}
            placeholder="0"
            value={formData.prix_vente_ttc}
            onChange={(val) => setFormData({ ...formData, prix_vente_ttc: Number(val) || 0 })}
            min={0}
            step={500}
            size="sm"
          />
          {formData.prix_vente_ttc > 0 && formData.quantite_par_unite_base > 1 && (
            <Text size="xs" c="dimmed">
              Prix unitaire : {prixParUnite(formData.prix_vente_ttc, formData.quantite_par_unite_base)} F/{uniteBase}
            </Text>
          )}
          <Switch
            label="Conditionnement par défaut"
            description="Pré-sélectionné lors de la vente de ce produit"
            checked={formData.est_conditionnement_par_defaut}
            onChange={(e) => setFormData({ ...formData, est_conditionnement_par_defaut: e.currentTarget.checked })}
            size="sm"
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="outline" onClick={closeModal} size="sm">
              Annuler
            </Button>
            <Button onClick={handleSave} size="sm">
              {editing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
};

export default GestionConditionnements;
