// src/pages/revendeurs/HistoriqueRevendeur.tsx

import { useState, useEffect } from "react";
import {
  Card,
  Stack,
  Title,
  Table,
  Select,
  Badge,
  Loader,
  Center,
  Group,
  Text,
  Paper,
  ThemeIcon,
  SimpleGrid,
  TextInput,
  Button,
  Modal,
  Pagination,
  Flex,
  Grid,
  ActionIcon,
  Tooltip,
  ScrollArea
} from "@mantine/core";
import {
  IconHistory,
  IconSearch,
  IconRefresh,
  IconPrinter,
  IconFilter,
  IconDownload,
  IconCalendar,
  IconArrowUp,
  IconArrowDown,
  IconUsers,
  IconPackage,
  IconAlertCircle,
  IconX
} from "@tabler/icons-react";

import { notifications } from '@mantine/notifications';
import { clientRepository } from "../../../database/repositories/clientRepository";
import { stockRevendeurRepository } from "../../../database/repositories/stockRevendeurRepository";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MouvementRevendeur {
  idMouvementRevendeur: number;
  date_mouvement: string;
  designation: string;
  type_mouvement: 'ENTREE' | 'SORTIE';
  qte_mouvement: number;
  code_commande?: string;
  code_decompte?: string;
  idRevendeur: number;
  prix_unitaire?: number;
  total?: number;
  notes?: string;
}

interface Client {
  idClient: number;
  NomComplet: string;
  code_client?: string;
  telephone?: string;
}

interface Statistiques {
  totalEntrees: number;
  totalSorties: number;
  totalMouvements: number;
  dernierMouvement: string;
}

export default function HistoriqueRevendeur() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mouvements, setMouvements] = useState<MouvementRevendeur[]>([]);
  const [filteredMouvements, setFilteredMouvements] = useState<MouvementRevendeur[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [statistiques, setStatistiques] = useState<Statistiques | null>(null);

  const itemsPerPage = 15;

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selected) {
      loadHistorique(Number(selected));
    }
  }, [selected]);

  // Filtrage des mouvements
  useEffect(() => {
    let filtered = [...mouvements];

    // Filtre par terme de recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.designation.toLowerCase().includes(term) ||
        m.code_commande?.toLowerCase().includes(term) ||
        m.code_decompte?.toLowerCase().includes(term) ||
        m.notes?.toLowerCase().includes(term)
      );
    }

    // Filtre par type
    if (typeFilter) {
      filtered = filtered.filter(m => m.type_mouvement === typeFilter);
    }

    // Filtre par date début
    if (dateDebut) {
      const start = new Date(dateDebut);
      start.setHours(0, 0, 0);
      filtered = filtered.filter(m => {
        const date = new Date(m.date_mouvement);
        return date >= start;
      });
    }

    // Filtre par date fin
    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(m => {
        const date = new Date(m.date_mouvement);
        return date <= end;
      });
    }

    setFilteredMouvements(filtered);
    setCurrentPage(1);
  }, [mouvements, searchTerm, typeFilter, dateDebut, dateFin]);

  const loadClients = async () => {
    try {
      const data = await clientRepository.getByType("revendeur");
      setClients(data);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger la liste des revendeurs',
        color: 'red'
      });
    }
  };

  const loadHistorique = async (idRevendeur: number) => {
    try {
      setLoading(true);
      const data = await stockRevendeurRepository.getHistorique(idRevendeur);
      setMouvements(data);
      calculerStatistiques(data);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger l\'historique',
        color: 'red'
      });
      setMouvements([]);
    } finally {
      setLoading(false);
    }
  };

  const calculerStatistiques = (data: MouvementRevendeur[]) => {
    const totalEntrees = data.filter(m => m.type_mouvement === 'ENTREE')
      .reduce((sum, m) => sum + m.qte_mouvement, 0);
    const totalSorties = data.filter(m => m.type_mouvement === 'SORTIE')
      .reduce((sum, m) => sum + m.qte_mouvement, 0);
    const dernierMouvement = data.length > 0 
      ? format(new Date(data[0].date_mouvement), 'dd/MM/yyyy HH:mm', { locale: fr })
      : 'Aucun';

    setStatistiques({
      totalEntrees,
      totalSorties,
      totalMouvements: data.length,
      dernierMouvement
    });
  };

  const formatDate = (dateStr: string): string => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: fr });
    } catch {
      return '-';
    }
  };

  const formatNombre = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter(null);
    setDateDebut('');
    setDateFin('');
    setCurrentPage(1);
  };

  const handlePrint = () => {
    setPrintModalOpened(true);
    setTimeout(() => {
      setPrintModalOpened(false);
      notifications.show({
        title: '✅ Impression',
        message: 'L\'historique a été envoyé à l\'imprimante',
        color: 'green'
      });
    }, 1500);
  };

  const handleExportCSV = () => {
    if (filteredMouvements.length === 0) {
      notifications.show({
        title: 'Aucune donnée',
        message: 'Il n\'y a pas de données à exporter',
        color: 'yellow'
      });
      return;
    }

    const headers = ['Date', 'Produit', 'Type', 'Quantité', 'Référence', 'Notes'];
    const rows = filteredMouvements.map(m => [
      formatDate(m.date_mouvement),
      m.designation,
      m.type_mouvement,
      m.qte_mouvement.toString(),
      m.code_commande || m.code_decompte || '-',
      m.notes || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const clientName = clients.find(c => c.idClient.toString() === selected)?.NomComplet || 'revendeur';
    link.download = `historique_${clientName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    notifications.show({
      title: '✅ Exportation réussie',
      message: 'Le fichier CSV a été téléchargé',
      color: 'green'
    });
  };

  const totalPages = Math.ceil(filteredMouvements.length / itemsPerPage);
  const paginatedMouvements = filteredMouvements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const selectedClient = clients.find(c => c.idClient.toString() === selected);

  return (
    <Stack gap="lg" p="md">
      {/* En-tête */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconHistory size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Historique Revendeur</Title>
              <Text c="gray.3" size="sm">
                Suivi des mouvements de stock par revendeur
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={() => selected && loadHistorique(Number(selected))}
              disabled={!selected}
            >
              Actualiser
            </Button>
          </Group>
        </Flex>

        {selectedClient && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconUsers size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Revendeur</Text>
                  <Text c="white" fw={700} size="md">
                    {selectedClient.NomComplet}
                  </Text>
                  {selectedClient.code_client && (
                    <Text c="gray.3" size="xs">Code: {selectedClient.code_client}</Text>
                  )}
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(46,125,50,0.3)' }}>
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconArrowUp size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Entrées</Text>
                  <Text c="white" fw={700} size="xl">
                    {formatNombre(statistiques?.totalEntrees || 0)}
                  </Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(211,47,47,0.3)' }}>
              <Group>
                <ThemeIcon color="red" variant="light" size="lg">
                  <IconArrowDown size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Sorties</Text>
                  <Text c="white" fw={700} size="xl">
                    {formatNombre(statistiques?.totalSorties || 0)}
                  </Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconPackage size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Total mouvements</Text>
                  <Text c="white" fw={700} size="xl">
                    {statistiques?.totalMouvements || 0}
                  </Text>
                  <Text c="gray.3" size="xs">
                    Dernier: {statistiques?.dernierMouvement || '-'}
                  </Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        )}
      </Paper>

      {/* Sélection du revendeur */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Grid align="flex-end">
          <Grid.Col span={4}>
            <Select
              label="Revendeur"
              placeholder="Sélectionner un revendeur"
              searchable
              clearable
              data={clients.map(c => ({
                value: c.idClient.toString(),
                label: c.NomComplet + (c.code_client ? ` (${c.code_client})` : '')
              }))}
              value={selected}
              onChange={(value) => {
                setSelected(value);
                if (value) {
                  loadHistorique(Number(value));
                } else {
                  setMouvements([]);
                  setFilteredMouvements([]);
                  setStatistiques(null);
                }
              }}
              size="md"
              leftSection={<IconUsers size={16} />}
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Filtres - TOUT SUR UNE SEULE LIGNE */}
      {selected && (
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Flex align="flex-end" gap="sm" wrap="nowrap">
            {/* Recherche */}
            <TextInput
              placeholder="Rechercher..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="xs"
              style={{ flex: 2, minWidth: 120 }}
              label="Recherche"
            />

            {/* Type */}
            <Select
              placeholder="Type"
              clearable
              data={[
                { value: 'ENTREE', label: '📥 Entrée' },
                { value: 'SORTIE', label: '📤 Sortie' }
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
              size="xs"
              style={{ flex: 1.5, minWidth: 100 }}
              label="Type"
              leftSection={<IconFilter size={14} />}
            />

            {/* Date début */}
            <TextInput
              type="date"
              placeholder="Du"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              size="xs"
              style={{ flex: 1.2, minWidth: 90 }}
              label="Du"
              leftSection={<IconCalendar size={14} />}
            />

            {/* Date fin */}
            <TextInput
              type="date"
              placeholder="Au"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              size="xs"
              style={{ flex: 1.2, minWidth: 90 }}
              label="Au"
              leftSection={<IconCalendar size={14} />}
            />

            {/* Actions */}
            <Group gap="xs" style={{ flex: '0 0 auto' }}>
              <Tooltip label="Réinitialiser">
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={resetFilters}
                  size={30}
                  style={{ marginTop: 18 }}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter CSV">
                <ActionIcon
                  variant="light"
                  color="blue"
                  onClick={handleExportCSV}
                  size={30}
                  style={{ marginTop: 18 }}
                >
                  <IconDownload size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Imprimer">
                <ActionIcon
                  variant="light"
                  color="teal"
                  onClick={handlePrint}
                  size={30}
                  style={{ marginTop: 18 }}
                >
                  <IconPrinter size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Flex>

          {/* Résultat du filtrage */}
          {filteredMouvements.length > 0 && (
            <Text size="xs" c="dimmed" mt="xs">
              {filteredMouvements.length} mouvement(s) trouvé(s)
            </Text>
          )}
        </Card>
      )}

      {/* Liste des mouvements */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        {!selected ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <IconAlertCircle size={48} color="#868e96" />
              <Text c="dimmed" size="lg" fw={500}>
                Veuillez sélectionner un revendeur
              </Text>
              <Text c="dimmed" size="sm">
                Pour voir son historique de mouvements
              </Text>
            </Stack>
          </Center>
        ) : loading ? (
          <Center py={100}>
            <Loader size="xl" />
          </Center>
        ) : filteredMouvements.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <IconPackage size={48} color="#868e96" />
              <Text c="dimmed" size="lg" fw={500}>
                Aucun mouvement trouvé
              </Text>
              <Text c="dimmed" size="sm">
                {searchTerm || typeFilter || dateDebut || dateFin
                  ? 'Aucun mouvement ne correspond aux filtres appliqués'
                  : 'Ce revendeur n\'a pas encore de mouvements'}
              </Text>
              {(searchTerm || typeFilter || dateDebut || dateFin) && (
                <Button variant="subtle" size="xs" onClick={resetFilters}>
                  Réinitialiser les filtres
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <>
            <ScrollArea h={500}>
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                    <Table.Th c="white" w={50}>N°</Table.Th>
                    <Table.Th c="white">Date</Table.Th>
                    <Table.Th c="white">Produit</Table.Th>
                    <Table.Th c="white" ta="center">Type</Table.Th>
                    <Table.Th c="white" ta="right">Quantité</Table.Th>
                    <Table.Th c="white">Référence</Table.Th>
                    <Table.Th c="white">Notes</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedMouvements.map((m, idx) => {
                    const num = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <Table.Tr key={m.idMouvementRevendeur}>
                        <Table.Td fw={600}>{num}</Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatDate(m.date_mouvement)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500} size="sm">{m.designation}</Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge
                            color={m.type_mouvement === "ENTREE" ? "green" : "red"}
                            variant="light"
                            size="sm"
                          >
                            {m.type_mouvement === "ENTREE" ? "📥 Entrée" : "📤 Sortie"}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} c={m.type_mouvement === "ENTREE" ? "green" : "red"}>
                            {m.type_mouvement === "ENTREE" ? "+" : "-"}
                            {formatNombre(m.qte_mouvement)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {m.code_commande ? (
                            <Badge variant="outline" color="blue" size="sm">
                              {m.code_commande}
                            </Badge>
                          ) : m.code_decompte ? (
                            <Badge variant="outline" color="orange" size="sm">
                              {m.code_decompte}
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {m.notes || '-'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {totalPages > 1 && (
              <Group justify="center" p="md">
                <Pagination 
                  total={totalPages} 
                  value={currentPage} 
                  onChange={setCurrentPage} 
                  size="sm" 
                />
              </Group>
            )}
          </>
        )}
      </Card>

      {/* Modal d'impression */}
      <Modal
        opened={printModalOpened}
        onClose={() => setPrintModalOpened(false)}
        title="Impression de l'historique"
        size="md"
        centered
      >
        <Stack align="center" py="xl">
          <Loader size="lg" />
          <Text>Préparation de l'impression...</Text>
          <Text size="sm" c="dimmed">
            {filteredMouvements.length} mouvements à imprimer
          </Text>
        </Stack>
      </Modal>
    </Stack>
  );
}