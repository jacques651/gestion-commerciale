// src/components/clients/ListeClients.tsx
import React, { useEffect, useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  TextInput,
  Table,
  Badge,
  ActionIcon,
  LoadingOverlay,
  Box,
  Pagination,
  Tooltip,
  Modal,
  Divider,
  ThemeIcon,
  SimpleGrid,
  Select,
} from '@mantine/core';
import {
  IconUsers,
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconRefresh,
  IconInfoCircle,
  IconUser,
  IconPhone,
  IconMapPin,
  IconBuildingStore,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import FormulaireClient from './FormulaireClient';

interface Client {
  idClient: number;
  code_client: string;
  nom_complet: string;
  societe: string;
  type_client: string;
  adresse: string;
  ville: string;
  telephone: string;
  email: string;
  est_actif: number;
}

const ListeClients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [vueForm, setVueForm] = useState(false);
  const [clientEdition, setClientEdition] = useState<Client | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerClients = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<Client[]>(`
      SELECT * FROM clients WHERE est_supprime = 0 ORDER BY nom_complet
    `);
    setClients(result || []);
    setLoading(false);
  };

  useEffect(() => {
    chargerClients();
  }, []);

  const supprimerClient = async (id: number) => {
    if (!confirm('Supprimer ce client ?')) return;
    const db = await getDb();
    await db.execute("UPDATE clients SET est_supprime = 1 WHERE idClient = ?", [id]);
    chargerClients();
  };

  const handleReset = () => {
    setRecherche('');
    setTypeFiltre(null);
    chargerClients();
    setCurrentPage(1);
  };

  const typesClients = [
    { value: 'PARTICULIER', label: '👤 Particulier' },
    { value: 'REVENDEUR', label: '🔄 Revendeur' },
    { value: 'ENTREPRISE', label: '🏢 Entreprise' },
  ];

  const clientsFiltres = clients.filter(c => {
    const matchRecherche = c.nom_complet.toLowerCase().includes(recherche.toLowerCase()) ||
                          c.code_client.toLowerCase().includes(recherche.toLowerCase()) ||
                          (c.telephone && c.telephone.includes(recherche));
    const matchType = !typeFiltre || c.type_client === typeFiltre;
    return matchRecherche && matchType;
  });

  const totalPages = Math.ceil(clientsFiltres.length / itemsPerPage);
  const paginatedData = clientsFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'PARTICULIER':
        return { label: 'Particulier', color: 'blue', icon: <IconUser size={12} /> };
      case 'REVENDEUR':
        return { label: 'Revendeur', color: 'orange', icon: <IconBuildingStore size={12} /> };
      case 'ENTREPRISE':
        return { label: 'Entreprise', color: 'green', icon: <IconBuildingStore size={12} /> };
      default:
        return { label: type, color: 'gray', icon: <IconUser size={12} /> };
    }
  };

  if (vueForm) {
    return (
      <FormulaireClient
        client={clientEdition || undefined}
        onSuccess={() => {
          setVueForm(false);
          setClientEdition(null);
          chargerClients();
        }}
        onCancel={() => {
          setVueForm(false);
          setClientEdition(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement des clients...</Text>
      </Card>
    );
  }

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* HEADER */}
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Stack gap={4}>
              <Group gap="xs">
                <IconUsers size={24} color="white" />
                <Title order={2} c="white">Clients</Title>
              </Group>
              <Text size="sm" c="gray.3">
                Gestion de la clientèle
              </Text>
            </Stack>
            <Group gap="md">
              <Button
                variant="light"
                color="white"
                leftSection={<IconInfoCircle size={18} />}
                onClick={() => setInfoModalOpen(true)}
              >
                Instructions
              </Button>
              <ThemeIcon size={48} radius="md" color="white" variant="light">
                <IconUsers size={28} />
              </ThemeIcon>
            </Group>
          </Group>
        </Card>

        {/* STATS KPI */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Total clients
              </Text>
              <ThemeIcon size={30} radius="md" color="blue" variant="light">
                <IconUsers size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="blue">
              {clients.length}
            </Text>
          </Card>

          <Card withBorder radius="md" p="md" bg="orange.0">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Revendeurs
              </Text>
              <ThemeIcon size={30} radius="md" color="orange" variant="light">
                <IconBuildingStore size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="orange">
              {clients.filter(c => c.type_client === 'REVENDEUR').length}
            </Text>
          </Card>

          <Card withBorder radius="md" p="md" bg="green.0">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Entreprises
              </Text>
              <ThemeIcon size={30} radius="md" color="green" variant="light">
                <IconBuildingStore size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="green">
              {clients.filter(c => c.type_client === 'ENTREPRISE').length}
            </Text>
          </Card>
        </SimpleGrid>

        {/* BARRE D'OUTILS */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group>
              <TextInput
                placeholder="Rechercher par nom, code ou téléphone..."
                leftSection={<IconSearch size={16} />}
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setCurrentPage(1);
                }}
                size="sm"
                style={{ width: 300 }}
              />
              <Select
                placeholder="Filtrer par type"
                data={[{ value: '', label: 'Tous' }, ...typesClients]}
                value={typeFiltre}
                onChange={setTypeFiltre}
                size="sm"
                style={{ width: 150 }}
                clearable
              />
            </Group>
            <Group>
              <Tooltip label="Actualiser">
                <ActionIcon variant="light" onClick={handleReset} size="lg">
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setClientEdition(null);
                  setVueForm(true);
                }}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                Nouveau client
              </Button>
            </Group>
          </Group>
        </Card>

        {/* TABLEAU DES CLIENTS */}
        <Card withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover>
            <Table.Thead style={{ backgroundColor: '#1b365d' }}>
              <Table.Tr>
                <Table.Th style={{ color: 'white' }}>Code</Table.Th>
                <Table.Th style={{ color: 'white' }}>Nom complet</Table.Th>
                <Table.Th style={{ color: 'white' }}>Téléphone</Table.Th>
                <Table.Th style={{ color: 'white' }}>Type</Table.Th>
                <Table.Th style={{ color: 'white' }}>Ville</Table.Th>
                <Table.Th style={{ color: 'white', textAlign: 'center' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedData.map((c) => {
                const typeBadge = getTypeBadge(c.type_client);
                return (
                  <Table.Tr key={c.idClient}>
                    <Table.Td>
                      <Badge color="gray" variant="light" size="sm">
                        {c.code_client}
                      </Badge>
                    </Table.Td>
                    <Table.Td fw={500}>{c.nom_complet}</Table.Td>
                    <Table.Td>
                      {c.telephone ? (
                        <Group gap={4}>
                          <IconPhone size={12} />
                          <Text size="sm">{c.telephone}</Text>
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={typeBadge.color} variant="light" size="sm" leftSection={typeBadge.icon}>
                        {typeBadge.label}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {c.ville ? (
                        <Group gap={4}>
                          <IconMapPin size={12} />
                          <Text size="sm">{c.ville}</Text>
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} justify="center">
                        <Tooltip label="Modifier">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="orange"
                            onClick={() => {
                              setClientEdition(c);
                              setVueForm(true);
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Supprimer">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => supprimerClient(c.idClient)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                color="blue"
                size="sm"
              />
            </Group>
          )}
        </Card>

        {/* MODAL INSTRUCTIONS */}
        <Modal
          opened={infoModalOpen}
          onClose={() => setInfoModalOpen(false)}
          title="📋 Instructions"
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
          <Stack gap="md">
            <Text size="sm">1. Utilisez le bouton "Nouveau client" pour ajouter un client</Text>
            <Text size="sm">2. La recherche filtre par nom, code ou téléphone</Text>
            <Text size="sm">3. Le filtre par type permet de voir les particuliers, revendeurs ou entreprises</Text>
            <Text size="sm">4. Cliquez sur ✏️ pour modifier un client</Text>
            <Text size="sm">5. Cliquez sur 🗑️ pour supprimer un client</Text>
            <Divider />
            <Text size="xs" c="dimmed" ta="center">
              Version 1.0.0 - Gestion Commerciale
            </Text>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default ListeClients;