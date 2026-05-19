// src/components/reglements/ListeReglements.tsx
import React, { useState } from 'react';
import {
  Table, Group, Badge, ActionIcon, Stack, Title, Card, Text,
  Tooltip, Pagination, Loader, Button, Paper, Flex, ThemeIcon,
  SimpleGrid, TextInput, Avatar, Modal, Divider, Box
} from '@mantine/core';
import {
  IconEye, IconSearch, IconRefresh, IconCash,
  
  IconCalendar, IconPlus
} from '@tabler/icons-react';
import { useReglements } from '../../hooks/useReglements';
import { FormulaireReglement } from './FormulaireReglement';

// Interface simplifiée sans propriétés problématiques
interface ReglementItem {
  idReglement: number;
  code_reglement: string;
  idClient: number;
  date_reglement: string;
  montant: number;
  mode_reglement: string;
  reference: string | null;
  client_nom?: string;
}

export const ListeReglements: React.FC = () => {
  const { reglements, loading, refresh } = useReglements();
  
  const [modalOpened, setModalOpened] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFiltre, setModeFiltre] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedReglement, setSelectedReglement] = useState<ReglementItem | null>(null);
  
  const itemsPerPage = 10;

  const getModeBadge = (mode: string) => {
    const config: Record<string, { color: string; label: string }> = {
      ESPECES: { color: 'green', label: 'Espèces' },
      CHEQUE: { color: 'blue', label: 'Chèque' },
      VIREMENT: { color: 'violet', label: 'Virement' },
      CARTE: { color: 'cyan', label: 'Carte' },
      MOBILE_MONEY: { color: 'orange', label: 'Mobile Money' },
    };
    const modeConfig = config[mode] || { color: 'gray', label: mode };
    return <Badge color={modeConfig.color} variant="light">{modeConfig.label}</Badge>;
  };

  // Filtrage
  const filteredReglements = (reglements as ReglementItem[]).filter((r) => {
    const matchSearch = searchTerm === '' || 
      r.code_reglement?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.client_nom?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchMode = !modeFiltre || r.mode_reglement === modeFiltre;
    return matchSearch && matchMode;
  });

  const stats = {
    total: (reglements as ReglementItem[]).length,
    totalMontant: (reglements as ReglementItem[]).reduce((sum, r) => sum + (r.montant || 0), 0),
    especes: (reglements as ReglementItem[]).filter((r) => r.mode_reglement === 'ESPECES').length,
    mobileMoney: (reglements as ReglementItem[]).filter((r) => r.mode_reglement === 'MOBILE_MONEY').length,
  };

  const totalPages = Math.ceil(filteredReglements.length / itemsPerPage);
  const paginatedReglements = filteredReglements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatMontant = (value: number): string => (value || 0).toLocaleString('fr-FR');

  const resetFilters = () => {
    setSearchTerm('');
    setModeFiltre(null);
    setCurrentPage(1);
  };

  if (loading && (reglements as ReglementItem[]).length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des règlements...</Text>
      </Card>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* En-tête */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconCash size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white" style={{ fontSize: '2rem' }}>Règlements</Title>
              <Text c="gray.3" size="sm">Gestion des encaissements et paiements clients</Text>
            </div>
          </Group>
          <Button
            variant="light"
            color="white"
            leftSection={<IconPlus size={18} />}
            onClick={() => setModalOpened(true)}
          >
            Nouveau règlement
          </Button>
        </Flex>

        {/* Cartes statistiques */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Total règlements</Text>
            <Text c="white" fw={700} size="xl">{stats.total}</Text>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Montant total</Text>
            <Text c="white" fw={700} size="xl">{formatMontant(stats.totalMontant)} F</Text>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Espèces</Text>
            <Text c="white" fw={700} size="xl">{stats.especes}</Text>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Mobile Money</Text>
            <Text c="white" fw={700} size="xl">{stats.mobileMoney}</Text>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Barre d'outils */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Flex gap="md" wrap="wrap">
          <TextInput
            placeholder="Rechercher par code, client..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ flex: 2, minWidth: 200 }}
          />
          <TextInput
            placeholder="Mode de règlement"
            value={modeFiltre || ''}
            onChange={(e) => setModeFiltre(e.target.value || null)}
            style={{ width: 180 }}
          />
          <Button variant="light" onClick={resetFilters} leftSection={<IconRefresh size={16} />}>
            Réinitialiser
          </Button>
          <Tooltip label="Actualiser">
            <ActionIcon variant="light" onClick={refresh} size="lg" color="adminBlue">
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Flex>
      </Card>

      {/* Tableau */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
            <Table.Thead style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)', }}>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Client</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th ta="right">Montant</Table.Th>
                <Table.Th>Mode</Table.Th>
                <Table.Th>Référence</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedReglements.map((r) => (
                <Table.Tr key={r.idReglement}>
                  <Table.Td>
                    <Text fw={600} size="sm" c="adminBlue">{r.code_reglement}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar size="sm" radius="xl" color="blue">
                        {(r.client_nom || 'C').charAt(0).toUpperCase()}
                      </Avatar>
                      <Text fw={500} size="sm">{r.client_nom || 'Client inconnu'}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <IconCalendar size={12} color="#1b365d" />
                      <Text size="sm">{new Date(r.date_reglement).toLocaleDateString('fr-FR')}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} c="green" size="sm">{formatMontant(r.montant)} FCFA</Text>
                  </Table.Td>
                  <Table.Td>{getModeBadge(r.mode_reglement)}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.reference || '-'}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Tooltip label="Voir détails">
                      <ActionIcon 
                        variant="light" 
                        color="adminBlue" 
                        size="md"
                        onClick={() => {
                          setSelectedReglement(r);
                          setDetailsModalOpen(true);
                        }}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>

        {filteredReglements.length === 0 && (
          <Flex justify="center" align="center" direction="column" py={60}>
            <IconCash size={60} color="#ccc" />
            <Text ta="center" c="dimmed" mt="md">Aucun règlement trouvé</Text>
          </Flex>
        )}

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={setCurrentPage}
              size="md"
            />
          </Group>
        )}
      </Card>

      {/* Modal détails */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => { setDetailsModalOpen(false); setSelectedReglement(null); }}
        title={`Détails du règlement ${selectedReglement?.code_reglement || ''}`}
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        {selectedReglement && (
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <Card withBorder p="sm" bg="gray.0" radius="md">
                <Text size="xs" c="dimmed">Code règlement</Text>
                <Text fw={600}>{selectedReglement.code_reglement}</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0" radius="md">
                <Text size="xs" c="dimmed">Date</Text>
                <Text>{new Date(selectedReglement.date_reglement).toLocaleDateString('fr-FR')}</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0" radius="md">
                <Text size="xs" c="dimmed">Client</Text>
                <Text>{selectedReglement.client_nom || 'Client inconnu'}</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0" radius="md">
                <Text size="xs" c="dimmed">Mode</Text>
                {getModeBadge(selectedReglement.mode_reglement)}
              </Card>
              <Card withBorder p="sm" bg="gray.0" radius="md">
                <Text size="xs" c="dimmed">Montant</Text>
                <Text fw={700} c="green" size="lg">{formatMontant(selectedReglement.montant)} FCFA</Text>
              </Card>
              {selectedReglement.reference && (
                <Card withBorder p="sm" bg="gray.0" radius="md">
                  <Text size="xs" c="dimmed">Référence</Text>
                  <Text>{selectedReglement.reference}</Text>
                </Card>
              )}
            </SimpleGrid>

            <Divider />
            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setDetailsModalOpen(false)}>
                Fermer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Formulaire nouveau règlement */}
      <FormulaireReglement 
        opened={modalOpened} 
        onClose={() => {
          setModalOpened(false);
          refresh();
        }} 
      />
    </Stack>
  );
};

export default ListeReglements;