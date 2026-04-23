// src/components/factures/ListeFactures.tsx
import React, { useEffect, useState } from 'react';
import { Stack, Card, Title, Text, Group, Button, Table, Badge, ActionIcon, LoadingOverlay, Box, Pagination, Tooltip, Modal, Divider, ThemeIcon, SimpleGrid, Select, TextInput } from '@mantine/core';
import { IconFileText, IconEye, IconPrinter, IconSearch, IconInfoCircle, IconCalendar, IconCash } from '@tabler/icons-react';
import { getDb } from '../../database/db';

interface Facture { idFacture: number; code_facture: string; idCommande: number; client_nom: string; date_facture: string; montant_ttc: number; statut: string; }

const ListeFactures: React.FC = () => {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [statutFiltre, setStatutFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerFactures = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<Facture[]>(`SELECT f.*, c.nom_complet as client_nom FROM factures f JOIN commandes cmd ON f.idCommande = cmd.idCommande JOIN clients c ON cmd.idClient = c.idClient ORDER BY f.date_facture DESC`);
    setFactures(result || []);
    setLoading(false);
  };

  useEffect(() => { chargerFactures(); }, []);

  const facturesFiltrees = factures.filter(f => f.code_facture.toLowerCase().includes(recherche.toLowerCase()) || f.client_nom.toLowerCase().includes(recherche.toLowerCase()));
  const totalPages = Math.ceil(facturesFiltrees.length / itemsPerPage);
  const paginatedData = facturesFiltrees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalMontant = facturesFiltrees.reduce((sum, f) => sum + f.montant_ttc, 0);

  if (loading) return (<Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>);

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between"><Stack gap={4}><Group gap="xs"><IconFileText size={24} color="white" /><Title order={2} c="white">Factures</Title></Group><Text size="sm" c="gray.3">Gestion des factures clients</Text></Stack><Group gap="md"><Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>Instructions</Button><ThemeIcon size={48} radius="md" color="white" variant="light"><IconFileText size={28} /></ThemeIcon></Group></Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total factures</Text><ThemeIcon size={30} radius="md" color="blue" variant="light"><IconFileText size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="blue">{factures.length}</Text></Card>
          <Card withBorder radius="md" p="md" bg="green.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Montant total</Text><ThemeIcon size={30} radius="md" color="green" variant="light"><IconCash size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="green">{totalMontant.toLocaleString()} FCFA</Text></Card>
        </SimpleGrid>

        <Card withBorder radius="md" p="md"><Group justify="space-between"><TextInput placeholder="Rechercher..." leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }} size="sm" style={{ width: 300 }} /><Select placeholder="Statut" data={[{ value: '', label: 'Tous' }, { value: 'EN_ATTENTE', label: 'En attente' }, { value: 'PARTIELLE', label: 'Partielle' }, { value: 'PAYEE', label: 'Payée' }]} value={statutFiltre} onChange={setStatutFiltre} size="sm" style={{ width: 130 }} clearable /></Group></Card>

        <Card withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover><Table.Thead style={{ backgroundColor: '#1b365d' }}><Table.Tr><Table.Th style={{ color: 'white' }}>Code</Table.Th><Table.Th style={{ color: 'white' }}>Client</Table.Th><Table.Th style={{ color: 'white' }}>Date</Table.Th><Table.Th style={{ color: 'white', textAlign: 'right' }}>Montant</Table.Th><Table.Th style={{ color: 'white', textAlign: 'center' }}>Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{paginatedData.map((f) => (<Table.Tr key={f.idFacture}><Table.Td><Badge color="gray" variant="light" size="sm">{f.code_facture}</Badge></Table.Td><Table.Td fw={500}>{f.client_nom}</Table.Td><Table.Td><Group gap={4}><IconCalendar size={12} /><Text size="sm">{new Date(f.date_facture).toLocaleDateString('fr-FR')}</Text></Group></Table.Td><Table.Td ta="right" fw={600}>{f.montant_ttc.toLocaleString()} FCFA</Table.Td><Table.Td><Tooltip label="Voir"><ActionIcon size="sm" color="blue" onClick={() => { setSelectedFacture(f); setModalOpen(true); }}><IconEye size={16} /></ActionIcon></Tooltip></Table.Td></Table.Tr>))}</Table.Tbody>
          </Table>
          {totalPages > 1 && (<Group justify="center" p="md"><Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="blue" size="sm" /></Group>)}
        </Card>

        <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={`Facture ${selectedFacture?.code_facture}`} size="xl" centered styles={{ header: { backgroundColor: '#1b365d', padding: '16px 20px' }, title: { color: 'white', fontWeight: 600 }, body: { padding: '20px' } }}>
          {selectedFacture && (<Stack><Text fw={500}>Client: {selectedFacture.client_nom}</Text><Text>Date: {new Date(selectedFacture.date_facture).toLocaleDateString('fr-FR')}</Text><Text fw={700} size="xl">Montant: {selectedFacture.montant_ttc.toLocaleString()} FCFA</Text><Divider /><Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>Imprimer</Button></Stack>)}
        </Modal>

        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: '#1b365d', padding: '16px 20px' }, title: { color: 'white', fontWeight: 600 }, body: { padding: '20px' } }}>
          <Stack gap="md"><Text size="sm">1. Les factures sont générées à partir des commandes</Text><Text size="sm">2. Le statut évolue automatiquement avec les règlements</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default ListeFactures;