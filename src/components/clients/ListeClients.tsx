// src/components/clients/ListeClients.tsx
import React, { useState } from 'react';
import {
  Table, TextInput, Button, Group, Badge, ActionIcon,
  Stack, Title, Card, Text, Tooltip, Pagination, Paper,
  Flex, ThemeIcon, Avatar, SimpleGrid, Loader, Modal, Alert} from '@mantine/core';
import {
  IconSearch, IconPlus, IconEdit, IconTrash, IconPhone,
  IconUsers, IconBuildingStore, IconUserCheck,
  IconUserPlus, IconMapPin, IconX, IconAlertCircle
} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { FormulaireClient } from './FormulaireClient';
import { Client } from '../../database/repositories/clientRepository';
import { notifications } from '@mantine/notifications';

export const ListeClients: React.FC = () => {
  const { clients, loading, deleteClient, searchClients, refresh } = useClients();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpened, setModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSearch = () => {
    searchClients(searchTerm);
  };

  const handleDeleteClick = (client: Client) => {
    setSelectedClient(client);
    setDeleteModalOpened(true);
  };

  const confirmDelete = async () => {
    if (selectedClient) {
      const nom = selectedClient.NomComplet || selectedClient.Societe || 'Client';
      await deleteClient(selectedClient.idClient);
      notifications.show({
        title: 'Succès',
        message: `Client "${nom}" supprimé avec succès`,
        color: 'green',
      });
      setDeleteModalOpened(false);
      setSelectedClient(null);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setModalOpened(true);
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    setEditingClient(null);
    refresh();
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      client: 'blue',
      revendeur: 'green',
    };
    const labels: Record<string, string> = {
      client: 'Client',
      revendeur: 'Revendeur',
    };
    const icons: Record<string, React.ReactNode> = {
      client: <IconUserCheck size={12} />,
      revendeur: <IconBuildingStore size={12} />,
    };
    return (
      <Badge
        color={colors[type] || 'gray'}
        variant="light"
        size="md"
        leftSection={icons[type]}
      >
        {labels[type] || type}
      </Badge>
    );
  };

  const getNomAffichage = (client: Client) => {
    if (client.NomComplet) return client.NomComplet;
    if (client.Societe) return client.Societe;
    return 'Client sans nom';
  };

  // Statistiques
  const stats = {
    total: clients.length,
    revendeurs: clients.filter(c => c.TypeClient === 'revendeur').length,
    clients: clients.filter(c => c.TypeClient === 'client').length,
    avecTel: clients.filter(c => c.Tel).length
  };

  // Pagination
  const totalPages = Math.ceil(clients.length / itemsPerPage);
  const paginatedClients = clients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading && clients.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des clients...</Text>
      </Card>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        {/* EN-TÊTE ATTRACTIF */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={50} radius="md" color="white" variant="light">
                  <IconUsers size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Clients</Title>
                  <Text c="gray.3" size="sm">Gérez votre portefeuille clients</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button
                size="md"
                variant="light"
                color="white"
                leftSection={<IconUserPlus size={18} />}
                onClick={() => setModalOpened(true)}
              >
                Nouveau client
              </Button>
            </Group>
          </Flex>

          {/* Cartes statistiques */}
          <SimpleGrid cols={4} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconUsers size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Total clients</Text>
                  <Text c="white" fw={700} size="xl">{stats.total}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconUserCheck size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Clients standards</Text>
                  <Text c="white" fw={700} size="xl">{stats.clients}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Revendeurs</Text>
                  <Text c="white" fw={700} size="xl">{stats.revendeurs}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="yellow" variant="light" size="lg">
                  <IconPhone size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Contacts enregistrés</Text>
                  <Text c="white" fw={700} size="xl">{stats.avecTel}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* SECTION RECHERCHE */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between" mb="md">
            <Group>
              <IconSearch size={20} color="#1b365d" />
              <Title order={3} size="h4">Rechercher</Title>
            </Group>
            {searchTerm && (
              <Button variant="light" color="gray" onClick={() => {
                setSearchTerm('');
                refresh();
              }} size="xs" leftSection={<IconX size={14} />}>
                Réinitialiser
              </Button>
            )}
          </Group>

          <Group grow>
            <TextInput
              placeholder="Rechercher par nom, société, téléphone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              leftSection={<IconSearch size={16} />}
              size="md"
            />
            <Button
              onClick={handleSearch}
              size="md"
              variant="filled"
              color="adminBlue"
              leftSection={<IconSearch size={16} />}
            >
              Rechercher
            </Button>
          </Group>
        </Card>

        {/* TABLEAU PRINCIPAL - VERSION COMPACTE */}
        <Card withBorder radius="md" shadow="sm" p={0}>
          <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="sm">
            <Table.Thead>
              <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px' }}>Client</Table.Th>
                <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px', width: 100 }}>Type</Table.Th>
                <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px' }}>Contact</Table.Th>
                <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px' }}>Ville</Table.Th>
                <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px', width: 80, textAlign: 'center' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedClients.map((client) => (
                <Table.Tr key={client.idClient} style={{ fontSize: '13px' }}>
                  <Table.Td style={{ padding: '8px 12px' }}>
                    <Group gap="xs" wrap="nowrap">
                      <Avatar size="sm" radius="xl" color="blue">
                        {getNomAffichage(client).charAt(0).toUpperCase()}
                      </Avatar>
                      <div>
                        <Text fw={600} size="sm">{getNomAffichage(client)}</Text>
                        {client.Societe && client.Societe !== client.NomComplet && (
                          <Text size="xs" c="dimmed">{client.Societe}</Text>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ padding: '8px 12px' }}>{getTypeBadge(client.TypeClient)}</Table.Td>
                  <Table.Td style={{ padding: '8px 12px' }}>
                    {client.Tel ? (
                      <Group gap="4" wrap="nowrap">
                        <IconPhone size={12} color="#1b365d" />
                        <Text size="sm">{client.Tel}</Text>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ padding: '8px 12px' }}>
                    {client.Ville ? (
                      <Group gap="4" wrap="nowrap">
                        <IconMapPin size={12} color="#1b365d" />
                        <Text size="sm">{client.Ville}</Text>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <Group gap={4} justify="center" wrap="nowrap">
                      <Tooltip label="Modifier">
                        <ActionIcon variant="subtle" color="adminBlue" size="sm" onClick={() => handleEdit(client)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteClick(client)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {clients.length === 0 && (
            <Flex justify="center" align="center" direction="column" py={40}>
              <IconUsers size={40} color="#ccc" />
              <Text ta="center" c="dimmed" mt="sm" size="sm">Aucun client trouvé</Text>
              <Button mt="md" variant="light" size="sm" onClick={() => setModalOpened(true)} leftSection={<IconPlus size={14} />}>
                Ajouter un client
              </Button>
            </Flex>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="sm">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL CONFIRMATION SUPPRESSION */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Supprimer le client"
        centered
      >
        <Stack>
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Attention !">
            Êtes-vous sûr de vouloir supprimer ce client ?
            <Text size="sm" mt="md" c="red">
              Cette action est irréversible !
            </Text>
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setDeleteModalOpened(false)}>
              Annuler
            </Button>
            <Button color="red" onClick={confirmDelete}>
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* FORMULAIRE CLIENT */}
      <FormulaireClient
        opened={modalOpened}
        onClose={handleCloseModal}
        editClient={editingClient}
      />
    </>
  );
};

export default ListeClients;