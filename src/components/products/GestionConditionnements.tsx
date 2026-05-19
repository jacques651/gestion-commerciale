// src/components/products/GestionConditionnements.tsx
import React, { useState, useEffect } from 'react';
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
  ScrollArea
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconBoxMultiple,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';

interface Conditionnement {
  idConditionnement: number;
  idProduit: number;
  code_conditionnement: string;
  libelle: string;
  quantite_unites: number;
  prix_vente: number;
  est_actif: number;
}

interface GestionConditionnementsProps {
  idProduit: number;
}

const GestionConditionnements: React.FC<GestionConditionnementsProps> = ({ idProduit }) => {
  const [conditionnements, setConditionnements] = useState<Conditionnement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conditionnement | null>(null);
  const [formData, setFormData] = useState({
    libelle: '',
    quantite_unites: 1,
    prix_vente: 0,
  });

  const loadConditionnements = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const result = await db.select<Conditionnement[]>(`
        SELECT * FROM conditionnements WHERE idProduit = ? AND est_actif = 1 ORDER BY quantite_unites ASC
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

  const handleSave = async () => {
    if (!formData.libelle.trim()) {
      alert('Veuillez saisir un libellé');
      return;
    }
    if (formData.quantite_unites < 1) {
      alert('La quantité doit être au moins 1');
      return;
    }
    if (formData.prix_vente < 0) {
      alert('Le prix doit être positif');
      return;
    }

    try {
      const db = await getDb();
      
      if (editing) {
        await db.execute(`
          UPDATE conditionnements 
          SET libelle = ?, quantite_unites = ?, prix_vente = ?
          WHERE idConditionnement = ?
        `, [formData.libelle, formData.quantite_unites, formData.prix_vente, editing.idConditionnement]);
      } else {
        const code = `COND-${Date.now()}`;
        await db.execute(`
          INSERT INTO conditionnements (idProduit, code_conditionnement, libelle, quantite_unites, prix_vente, est_actif)
          VALUES (?, ?, ?, ?, ?, 1)
        `, [idProduit, code, formData.libelle, formData.quantite_unites, formData.prix_vente]);
      }
      
      setModalOpen(false);
      setEditing(null);
      setFormData({ libelle: '', quantite_unites: 1, prix_vente: 0 });
      loadConditionnements();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id: number, libelle: string) => {
    if (!confirm(`Supprimer le conditionnement "${libelle}" ?`)) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM conditionnements WHERE idConditionnement = ?", [id]);
      loadConditionnements();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getPricePerUnit = (prixVente: number, quantite: number) => {
    if (quantite === 0) return 0;
    return (prixVente / quantite).toFixed(0);
  };

  if (loading) {
    return (
      <Card withBorder p="sm">
        <Text size="sm" ta="center">Chargement...</Text>
      </Card>
    );
  }

  return (
    <Card withBorder p="sm" radius="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconBoxMultiple size={18} />
          <Title order={6}>Conditionnements</Title>
          <Badge size="xs" variant="light" color="blue">
            {conditionnements.length}
          </Badge>
        </Group>
        <Button 
          size="xs" 
          leftSection={<IconPlus size={12} />} 
          onClick={() => setModalOpen(true)}
          variant="light"
        >
          Ajouter
        </Button>
      </Group>

      <Divider mb="sm" />

      {conditionnements.length === 0 ? (
        <Text ta="center" c="dimmed" py="md" size="sm">
          Aucun conditionnement
        </Text>
      ) : (
        <ScrollArea h={200}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Libellé</Table.Th>
                <Table.Th>Contenu</Table.Th>
                <Table.Th>Prix</Table.Th>
                <Table.Th>Prix/un</Table.Th>
                <Table.Th style={{ textAlign: 'center', width: 60 }}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {conditionnements.map((c) => (
                <Table.Tr key={c.idConditionnement}>
                  <Table.Td>
                    <Badge color="blue" variant="light" size="sm">
                      {c.libelle}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{c.quantite_unites} un.</Table.Td>
                  <Table.Td style={{ fontWeight: 600 }}>{c.prix_vente.toLocaleString()} F</Table.Td>
                  <Table.Td>
                    <Badge color="green" variant="light" size="xs">
                      {getPricePerUnit(c.prix_vente, c.quantite_unites)} F
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="center">
                      <Tooltip label="Modifier">
                        <ActionIcon
                          size="sm"
                          color="orange"
                          variant="subtle"
                          onClick={() => {
                            setEditing(c);
                            setFormData({
                              libelle: c.libelle,
                              quantite_unites: c.quantite_unites,
                              prix_vente: c.prix_vente,
                            });
                            setModalOpen(true);
                          }}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => handleDelete(c.idConditionnement, c.libelle)}
                        >
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
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setFormData({ libelle: '', quantite_unites: 1, prix_vente: 0 });
        }}
        title={editing ? "Modifier" : "Nouveau conditionnement"}
        size="sm"
        centered
        padding="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Libellé"
            placeholder="Ex: Paquet, Carton, Lot..."
            value={formData.libelle}
            onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
            size="sm"
            required
          />
          <NumberInput
            label="Nb d'unités"
            description="Quantité dans ce conditionnement"
            placeholder="Ex: 12"
            value={formData.quantite_unites}
            onChange={(val) => setFormData({ ...formData, quantite_unites: Number(val) || 1 })}
            min={1}
            size="sm"
            required
          />
          <NumberInput
            label="Prix de vente (FCFA)"
            placeholder="Prix pour ce conditionnement"
            value={formData.prix_vente}
            onChange={(val) => setFormData({ ...formData, prix_vente: Number(val) || 0 })}
            min={0}
            step={500}
            size="sm"
            required
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="outline" onClick={() => setModalOpen(false)} size="sm">
              Annuler
            </Button>
            <Button onClick={handleSave} size="sm">
              {editing ? 'Modifier' : 'Ajouter'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
};

export default GestionConditionnements;