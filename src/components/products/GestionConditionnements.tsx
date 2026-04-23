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
    const db = await getDb();
    const result = await db.select<Conditionnement[]>(`
      SELECT * FROM conditionnements WHERE idProduit = ? ORDER BY quantite_unites ASC
    `, [idProduit]);
    setConditionnements(result);
    setLoading(false);
  };

  useEffect(() => {
    loadConditionnements();
  }, [idProduit]);

  const handleSave = async () => {
    const db = await getDb();
    
    if (editing) {
      await db.execute(`
        UPDATE conditionnements 
        SET libelle=?, quantite_unites=?, prix_vente=?
        WHERE idConditionnement=?
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
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce conditionnement ?')) return;
    const db = await getDb();
    await db.execute("DELETE FROM conditionnements WHERE idConditionnement = ?", [id]);
    loadConditionnements();
  };

  const getPricePerUnit = (prixVente: number, quantite: number) => {
    return (prixVente / quantite).toFixed(0);
  };

  if (loading) {
    return <Text>Chargement...</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconBoxMultiple size={20} />
          <Title order={4}>Conditionnements</Title>
        </Group>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModalOpen(true)}>
          Nouveau
        </Button>
      </Group>

      <Divider />

      {conditionnements.length === 0 ? (
        <Text ta="center" c="dimmed" py={40}>
          Aucun conditionnement. Cliquez sur "Nouveau" pour ajouter un paquet, carton, etc.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Libellé</Table.Th>
              <Table.Th>Contenu</Table.Th>
              <Table.Th>Prix de vente</Table.Th>
              <Table.Th>Prix unitaire</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {conditionnements.map((c) => (
              <Table.Tr key={c.idConditionnement}>
                <Table.Td>
                  <Badge color="blue" variant="light" size="lg">
                    {c.libelle}
                  </Badge>
                </Table.Td>
                <Table.Td>{c.quantite_unites} unité(s)</Table.Td>
                <Table.Td fw={600}>{c.prix_vente.toLocaleString()} FCFA</Table.Td>
                <Table.Td>
                  <Badge color="green" variant="light">
                    {getPricePerUnit(c.prix_vente, c.quantite_unites)} FCFA/un
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="center">
                    <Tooltip label="Modifier">
                      <ActionIcon
                        size="sm"
                        color="orange"
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
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Supprimer">
                      <ActionIcon
                        size="sm"
                        color="red"
                        onClick={() => handleDelete(c.idConditionnement)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setFormData({ libelle: '', quantite_unites: 1, prix_vente: 0 });
        }}
        title={editing ? "Modifier le conditionnement" : "Nouveau conditionnement"}
        size="md"
        centered
        styles={{
          header: {
            backgroundColor: '#1b365d',
            padding: '16px 20px',
          },
          title: {
            color: 'white',
            fontWeight: 600,
          },
          body: {
            padding: '20px',
          },
        }}
      >
        <Stack>
          <TextInput
            label="Libellé"
            placeholder="Ex: Paquet de 12, Carton de 48..."
            value={formData.libelle}
            onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
            required
          />
          <NumberInput
            label="Nombre d'unités"
            placeholder="Quantité dans ce conditionnement"
            value={formData.quantite_unites}
            onChange={(val) => setFormData({ ...formData, quantite_unites: Number(val) })}
            min={1}
            required
          />
          <NumberInput
            label="Prix de vente (FCFA)"
            placeholder="Prix pour ce conditionnement"
            value={formData.prix_vente}
            onChange={(val) => setFormData({ ...formData, prix_vente: Number(val) })}
            min={0}
            step={500}
            required
          />
          <Divider />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default GestionConditionnements;