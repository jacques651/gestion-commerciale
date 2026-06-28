// src/components/clients/ListeClients.tsx
import React, { useState } from 'react';
import {
  Table, TextInput, Button, Group, Badge, ActionIcon,
  Stack, Title, Card, Text, Tooltip, Pagination, Paper,
  Flex, ThemeIcon, Avatar, SimpleGrid, Loader, Modal, Alert,
  ScrollArea, Grid, Select
} from '@mantine/core';
import {
  IconSearch, IconPlus, IconEdit, IconTrash, IconPhone,
  IconUsers, IconBuildingStore, IconUserCheck,
  IconUserPlus, IconMapPin, IconX, IconAlertCircle,
  IconMail, IconBuilding, IconFilter
} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { FormulaireClient } from './FormulaireClient';
import { PageHeader } from '../common/PageHeader';
import { Client } from '../../database/repositories/clientRepository';
import { notifications } from '@mantine/notifications';

export const ListeClients: React.FC = () => {
  const { clients, loading, deleteClient, searchClients, refresh } = useClients();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Extraire les types uniques
  const typesUniques = [...new Set(clients.map(c => c.TypeClient).filter(Boolean))];

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

  // Filtrer les clients
  const filteredClients = clients.filter(client => {
    const matchSearch = searchTerm === '' ||
      client.NomComplet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.Societe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.Tel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.Email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchType = !typeFiltre || client.TypeClient === typeFiltre;

    return matchSearch && matchType;
  });

  // Statistiques
  const stats = {
    total: clients.length,
    revendeurs: clients.filter(c => c.TypeClient === 'revendeur').length,
    clients: clients.filter(c => c.TypeClient === 'client').length,
    avecTel: clients.filter(c => c.Tel).length,
    filtered: filteredClients.length
  };

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFiltre(null);
    setCurrentPage(1);
    refresh();
  };

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
        <PageHeader
          title="Clients"
          subtitle="Gestion du portefeuille clients et revendeurs"
          icon={<IconUsers size={20} />}
          color="blue"
          action={{ label: 'Nouveau client', onClick: () => setModalOpened(true), icon: <IconUserPlus size={14} /> }}
          stats={[
            { label: 'Total', value: stats.total, icon: <IconUsers size={13} /> },
            { label: 'Standards', value: stats.clients, icon: <IconUserCheck size={13} /> },
            { label: 'Revendeurs', value: stats.revendeurs, icon: <IconBuildingStore size={13} />, color: '#40c057' },
            { label: 'Avec contact', value: stats.avecTel, icon: <IconPhone size={13} />, color: '#f59f00' },
          ]}
        />

        {/* SECTION RECHERCHE ET FILTRE - SUR UNE SEULE LIGNE */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Grid  align="flex-end">
            {/* Recherche */}
            <Grid.Col span={6}>
              <TextInput
                placeholder="Rechercher par nom, société, téléphone, email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); searchClients(e.target.value); }}
                leftSection={<IconSearch size={16} />}
                size="sm"
              />
            </Grid.Col>

            {/* Filtre Type */}
            <Grid.Col span={2.5}>
              <Select
                placeholder="Type de client"
                data={[
                  { value: '', label: 'Tous les types' },
                  ...typesUniques.map(t => ({ value: t, label: t === 'client' ? 'Client' : 'Revendeur' }))
                ]}
                value={typeFiltre}
                onChange={setTypeFiltre}
                clearable
                size="sm"
                leftSection={<IconFilter size={14} />}
              />
            </Grid.Col>

            {/* Boutons d'action */}
            <Grid.Col span={3.5}>
              <Group gap="xs" justify="flex-end">
                <Tooltip label="Réinitialiser">
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="md"
                    onClick={resetFilters}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Tooltip>
                <Text size="xs" c="dimmed">
                  {stats.filtered} client(s)
                </Text>
              </Group>
            </Grid.Col>
          </Grid>
        </Card>

        {/* TABLEAU PRINCIPAL */}
        <Card withBorder radius="md" shadow="sm" p={0}>
          <ScrollArea style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                  <Table.Th c="white" w={200}>Nom / Société</Table.Th>
                  <Table.Th c="white" w={100}>Type</Table.Th>
                  <Table.Th c="white" w={150}>Téléphone</Table.Th>
                  <Table.Th c="white" w={180}>Email</Table.Th>
                  <Table.Th c="white" w={150}>Adresse</Table.Th>
                  <Table.Th c="white" w={100}>Ville</Table.Th>
                  <Table.Th c="white" ta="center" w={100}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedClients.map((client) => (
                  <Table.Tr key={client.idClient}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Avatar size="md" radius="xl" color="blue">
                          {getNomAffichage(client).charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <Text fw={600} size="sm">{client.NomComplet || '-'}</Text>
                          {client.Societe && (
                            <Group gap={4}>
                              <IconBuilding size={12} color="#adb5bd" />
                              <Text size="xs" c="dimmed">{client.Societe}</Text>
                            </Group>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>{getTypeBadge(client.TypeClient)}</Table.Td>
                    <Table.Td>
                      {client.Tel ? (
                        <Group gap="4" wrap="nowrap">
                          <IconPhone size={14} color="#1b365d" />
                          <Text size="sm">{client.Tel}</Text>
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {client.Email ? (
                        <Group gap="4" wrap="nowrap">
                          <IconMail size={14} color="#1b365d" />
                          <Text size="sm">{client.Email}</Text>
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {client.Adresse ? (
                        <Text size="sm" lineClamp={1}>{client.Adresse}</Text>
                      ) : (
                        <Text size="xs" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {client.Ville ? (
                        <Group gap="4" wrap="nowrap">
                          <IconMapPin size={14} color="#1b365d" />
                          <Text size="sm">{client.Ville}</Text>
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="center">
                      <Group gap={4} justify="center" wrap="nowrap">
                        <Tooltip label="Modifier">
                          <ActionIcon 
                            variant="light" 
                            color="blue" 
                            size="md" 
                            onClick={() => handleEdit(client)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Supprimer">
                          <ActionIcon 
                            variant="light" 
                            color="red" 
                            size="md" 
                            onClick={() => handleDeleteClick(client)}
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
          </ScrollArea>

          {filteredClients.length === 0 && (
            <Flex justify="center" align="center" direction="column" py={60}>
              <IconUsers size={60} color="#ccc" />
              <Text ta="center" c="dimmed" mt="md">Aucun client trouvé</Text>
              <Button 
                mt="md" 
                variant="light" 
                onClick={() => setModalOpened(true)} 
                leftSection={<IconPlus size={16} />}
              >
                Ajouter un client
              </Button>
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

          {filteredClients.length > 0 && (
            <Paper p="md" style={{ borderTop: '1px solid #e5e7eb' }}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Affichage de {Math.min(filteredClients.length, (currentPage - 1) * itemsPerPage + 1)} à {Math.min(currentPage * itemsPerPage, filteredClients.length)} sur {filteredClients.length} clients
                </Text>
              </Group>
            </Paper>
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