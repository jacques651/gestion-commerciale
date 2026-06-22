// src/components/decomptes/ListeDecomptes.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Title,
  Table,
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
  Pagination,
  Flex,
  ActionIcon,
  Tooltip,
  ScrollArea,
  Select,
  Modal,
  Divider,
  Alert
} from '@mantine/core';
import {
  IconReceipt,
  IconSearch,
  IconRefresh,
  IconPrinter,
  IconEye,
  IconPlus,
  IconAlertCircle,
  IconX,
  IconTruck,
  IconCalendar
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { decompteRepository } from '../../database/repositories/decompteRepository';
import { clientRepository } from '../../database/repositories/clientRepository';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

// Interface alignée avec la structure réelle de la base de données
interface Decompte {
  idDecompte: number;
  idClient: number;
  code_decompte: string;
  date_decompte: string;
  montant_achat: number;
  montant_vente: number;
  montant_benefice: number;
  montant_commission: number;
  montant_net: number;
  statut: 'brouillon' | 'valide' | 'paye' | 'annule';
  observation?: string;
  periode_debut?: string;
  periode_fin?: string;
  notes?: string;
  nom_revendeur?: string;
  NomComplet?: string;
  Societe?: string;
}

interface Client {
  idClient: number;
  NomComplet: string;
  code_client?: string;
  TypeClient?: string;
}

interface Statistiques {
  total: number;
  totalValide: number;
  totalPaye: number;
  totalAnnule: number;
  totalBrouillon: number;
  montantTotal: number;
  montantTotalVente: number;
  montantTotalCommission: number;
  montantTotalBenefice: number;
}

export default function ListeDecomptes() {
  const navigate = useNavigate();
  const [decomptes, setDecomptes] = useState<Decompte[]>([]);
  const [filteredDecomptes, setFilteredDecomptes] = useState<Decompte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statutFilter, setStatutFilter] = useState<string | null>(null);
  const [revendeurFilter, setRevendeurFilter] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDecompte, setSelectedDecompte] = useState<Decompte | null>(null);
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [revendeurs, setRevendeurs] = useState<Client[]>([]);
  const [statistiques, setStatistiques] = useState<Statistiques>({
    total: 0,
    totalValide: 0,
    totalPaye: 0,
    totalAnnule: 0,
    totalBrouillon: 0,
    montantTotal: 0,
    montantTotalVente: 0,
    montantTotalCommission: 0,
    montantTotalBenefice: 0
  });

  const itemsPerPage = 15;

  // Chargement initial
  useEffect(() => {
    loadRevendeurs();
    loadDecomptes();
  }, []);

  // Filtrage
  useEffect(() => {
    let filtered = [...decomptes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.code_decompte?.toLowerCase().includes(term) ||
        d.nom_revendeur?.toLowerCase().includes(term) ||
        d.observation?.toLowerCase().includes(term) ||
        d.notes?.toLowerCase().includes(term)
      );
    }

    if (statutFilter) {
      filtered = filtered.filter(d => d.statut === statutFilter);
    }

    if (revendeurFilter) {
      filtered = filtered.filter(d => d.idClient === Number(revendeurFilter));
    }

    if (dateDebut) {
      const start = new Date(dateDebut);
      start.setHours(0, 0, 0);
      filtered = filtered.filter(d => {
        const date = new Date(d.date_decompte);
        return date >= start;
      });
    }

    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(d => {
        const date = new Date(d.date_decompte);
        return date <= end;
      });
    }

    setFilteredDecomptes(filtered);
    setCurrentPage(1);
    calculerStatistiques(filtered);
  }, [decomptes, searchTerm, statutFilter, revendeurFilter, dateDebut, dateFin]);

  const loadRevendeurs = async () => {
    try {
      const data = await clientRepository.getByType("revendeur");
      setRevendeurs(data);
    } catch (error) {
      console.error('Erreur chargement revendeurs:', error);
    }
  };

  const loadDecomptes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await decompteRepository.getAll();
      
      const enrichedData = await Promise.all(
        data.map(async (decompte: any) => {
          try {
            const client = await clientRepository.getById(decompte.idClient);
            return {
              ...decompte,
              nom_revendeur: client?.NomComplet || 'Inconnu'
            };
          } catch {
            return {
              ...decompte,
              nom_revendeur: 'Inconnu'
            };
          }
        })
      );
      
      setDecomptes(enrichedData);

      try {
        const stats = await decompteRepository.getStatistiques();
        setStatistiques({
          total: stats.total || 0,
          totalValide: stats.totalValide || 0,
          totalPaye: stats.totalPaye || 0,
          totalAnnule: stats.totalAnnule || 0,
          totalBrouillon: stats.totalBrouillon || 0,
          montantTotal: stats.montantTotal || 0,
          montantTotalVente: stats.montantTotalVente || 0,
          montantTotalCommission: stats.montantTotalCommission || 0,
          montantTotalBenefice: stats.montantTotalBenefice || 0
        });
      } catch (statsError) {
        console.warn('Impossible de charger les statistiques:', statsError);
      }
      
    } catch (error: any) {
      console.error('Erreur chargement décomptes:', error);
      setError(error?.message || 'Impossible de charger les décomptes');
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les décomptes',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculerStatistiques = (data: Decompte[]) => {
    const totalValide = data.filter(d => d.statut === 'valide').length;
    const totalPaye = data.filter(d => d.statut === 'paye').length;
    const totalAnnule = data.filter(d => d.statut === 'annule').length;
    const totalBrouillon = data.filter(d => d.statut === 'brouillon').length;
    const montantTotal = data.reduce((sum, d) => sum + (d.montant_net || 0), 0);
    const montantTotalVente = data.reduce((sum, d) => sum + (d.montant_vente || 0), 0);
    const montantTotalCommission = data.reduce((sum, d) => sum + (d.montant_commission || 0), 0);
    const montantTotalBenefice = data.reduce((sum, d) => sum + (d.montant_benefice || 0), 0);

    setStatistiques({
      total: data.length,
      totalValide,
      totalPaye,
      totalAnnule,
      totalBrouillon,
      montantTotal,
      montantTotalVente,
      montantTotalCommission,
      montantTotalBenefice
    });
  };

  // ✅ Fonction de formatage des montants en FCFA
  const formatMontant = (value: number) => {
    return (value || 0).toLocaleString('fr-FR', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'valide': return 'green';
      case 'paye': return 'blue';
      case 'annule': return 'red';
      case 'brouillon': return 'orange';
      default: return 'gray';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'valide': return 'Validé';
      case 'paye': return 'Payé';
      case 'annule': return 'Annulé';
      case 'brouillon': return 'Brouillon';
      default: return statut;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: fr });
    } catch {
      return '-';
    }
  };

  const formatDateHeure = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: fr });
    } catch {
      return '-';
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatutFilter(null);
    setRevendeurFilter(null);
    setDateDebut('');
    setDateFin('');
    setCurrentPage(1);
  };

  const handleViewDetail = (decompte: Decompte) => {
    setSelectedDecompte(decompte);
    setDetailModalOpened(true);
  };

  const handlePrint = (decompte: Decompte) => {
    navigate(`/decomptes/${decompte.idDecompte}/print`);
  };

  const totalPages = Math.ceil(filteredDecomptes.length / itemsPerPage);
  const paginatedDecomptes = filteredDecomptes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (error) {
    return (
      <Stack p="md">
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Erreur" 
          color="red"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
          <Button 
            variant="light" 
            color="red" 
            mt="md"
            leftSection={<IconRefresh size={16} />}
            onClick={loadDecomptes}
          >
            Réessayer
          </Button>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* En-tête */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconReceipt size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Décomptes</Title>
              <Text c="gray.3" size="sm">
                Gestion des décomptes des revendeurs
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={loadDecomptes}
              loading={loading}
            >
              Actualiser
            </Button>
            <Button
              color="green"
              leftSection={<IconPlus size={18} />}
              onClick={() => navigate('/decomptes/nouveau')}
            >
              Nouveau décompte
            </Button>
          </Group>
        </Flex>

        {/* Statistiques avec FCFA */}
        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Total</Text>
            <Text c="white" fw={700} size="xl">{statistiques.total}</Text>
          </Card>
          <Card bg="rgba(46,125,50,0.3)" radius="md" p="sm">
            <Text c="white" size="xs">Validés</Text>
            <Text c="white" fw={700} size="xl">{statistiques.totalValide}</Text>
          </Card>
          <Card bg="rgba(33,150,243,0.3)" radius="md" p="sm">
            <Text c="white" size="xs">Payés</Text>
            <Text c="white" fw={700} size="xl">{statistiques.totalPaye}</Text>
          </Card>
          <Card bg="rgba(255,152,0,0.3)" radius="md" p="sm">
            <Text c="white" size="xs">Brouillons</Text>
            <Text c="white" fw={700} size="xl">{statistiques.totalBrouillon}</Text>
          </Card>
          <Card bg="rgba(76,175,80,0.2)" radius="md" p="sm">
            <Text c="white" size="xs">Montant total</Text>
            <Text c="white" fw={700} size="xl">{formatMontant(statistiques.montantTotal)} FCFA</Text>
          </Card>
        </SimpleGrid>

        {/* Statistiques détaillées supplémentaires avec FCFA */}
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md" mt="md">
          <Card bg="rgba(255,255,255,0.05)" radius="md" p="xs">
            <Text c="gray.3" size="xs">Total ventes</Text>
            <Text c="white" fw={600} size="sm">{formatMontant(statistiques.montantTotalVente)} FCFA</Text>
          </Card>
          <Card bg="rgba(255,255,255,0.05)" radius="md" p="xs">
            <Text c="gray.3" size="xs">Commissions</Text>
            <Text c="white" fw={600} size="sm">{formatMontant(statistiques.montantTotalCommission)} FCFA</Text>
          </Card>
          <Card bg="rgba(255,255,255,0.05)" radius="md" p="xs">
            <Text c="gray.3" size="xs">Bénéfices</Text>
            <Text c="white" fw={600} size="sm">{formatMontant(statistiques.montantTotalBenefice)} FCFA</Text>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Filtres */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Flex align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            placeholder="Rechercher..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="xs"
            style={{ flex: 2, minWidth: 120 }}
            label="Recherche"
          />
          <Select
            placeholder="Statut"
            clearable
            data={[
              { value: 'brouillon', label: '📝 Brouillon' },
              { value: 'valide', label: '✅ Validé' },
              { value: 'paye', label: '💳 Payé' },
              { value: 'annule', label: '❌ Annulé' }
            ]}
            value={statutFilter}
            onChange={setStatutFilter}
            size="xs"
            style={{ flex: 1.5, minWidth: 120 }}
            label="Statut"
          />
          <Select
            placeholder="Revendeur"
            clearable
            searchable
            data={revendeurs.map(r => ({
              value: r.idClient.toString(),
              label: r.NomComplet
            }))}
            value={revendeurFilter}
            onChange={setRevendeurFilter}
            size="xs"
            style={{ flex: 1.5, minWidth: 120 }}
            label="Revendeur"
          />
          <TextInput
            type="date"
            placeholder="Du"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            size="xs"
            style={{ flex: 1, minWidth: 90 }}
            label="Du"
            leftSection={<IconCalendar size={14} />}
          />
          <TextInput
            type="date"
            placeholder="Au"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            size="xs"
            style={{ flex: 1, minWidth: 90 }}
            label="Au"
            leftSection={<IconCalendar size={14} />}
          />
          <Group gap="xs" style={{ flex: '0 0 auto' }}>
            <Tooltip label="Réinitialiser les filtres">
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
          </Group>
        </Flex>

        {filteredDecomptes.length > 0 && (
          <Text size="xs" c="dimmed" mt="xs">
            {filteredDecomptes.length} décompte(s) trouvé(s)
          </Text>
        )}
      </Card>

      {/* Liste des décomptes */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        {loading ? (
          <Center py={100}>
            <Loader size="xl" />
          </Center>
        ) : filteredDecomptes.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <IconReceipt size={48} color="#868e96" />
              <Text c="dimmed" size="lg" fw={500}>
                Aucun décompte trouvé
              </Text>
              <Text c="dimmed" size="sm">
                {searchTerm || statutFilter || revendeurFilter || dateDebut || dateFin
                  ? 'Aucun décompte ne correspond aux filtres appliqués'
                  : 'Commencez par créer un nouveau décompte'}
              </Text>
              {(searchTerm || statutFilter || revendeurFilter || dateDebut || dateFin) && (
                <Button variant="subtle" size="xs" onClick={resetFilters}>
                  Réinitialiser les filtres
                </Button>
              )}
              {!searchTerm && !statutFilter && !revendeurFilter && !dateDebut && !dateFin && (
                <Button 
                  variant="light" 
                  color="blue"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate('/decomptes/nouveau')}
                >
                  Créer un décompte
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
                    <Table.Th c="white">Code</Table.Th>
                    <Table.Th c="white">Revendeur</Table.Th>
                    <Table.Th c="white">Date</Table.Th>
                    <Table.Th c="white" ta="right">Montant Net</Table.Th>
                    <Table.Th c="white" ta="right">Bénéfice</Table.Th>
                    <Table.Th c="white" ta="center">Statut</Table.Th>
                    <Table.Th c="white" ta="center">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedDecomptes.map((decompte, idx) => {
                    const num = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <Table.Tr key={decompte.idDecompte}>
                        <Table.Td fw={600}>{num}</Table.Td>
                        <Table.Td>
                          <Badge variant="outline" color="blue" size="sm">
                            {decompte.code_decompte || 'N/A'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <IconTruck size={14} color="#868e96" />
                            <Text size="sm" lineClamp={1}>
                              {decompte.nom_revendeur || decompte.NomComplet || 'Inconnu'}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label={formatDateHeure(decompte.date_decompte)}>
                            <Text size="sm">{formatDate(decompte.date_decompte)}</Text>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} color="blue" size="sm">
                            {formatMontant(decompte.montant_net || 0)} FCFA
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text 
                            fw={600} 
                            size="sm"
                            color={(decompte.montant_benefice || 0) > 0 ? 'green' : 'red'}
                          >
                            {formatMontant(decompte.montant_benefice || 0)} FCFA
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge color={getStatutColor(decompte.statut)} size="sm">
                            {getStatutLabel(decompte.statut)}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Group gap="xs" justify="center" wrap="nowrap">
                            <Tooltip label="Voir détails">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                size="sm"
                                onClick={() => handleViewDetail(decompte)}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Imprimer">
                              <ActionIcon
                                variant="subtle"
                                color="teal"
                                size="sm"
                                onClick={() => handlePrint(decompte)}
                              >
                                <IconPrinter size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
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

      {/* Modal Détails */}
      <Modal
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        title="Détails du décompte"
        size="lg"
        centered
        styles={{
          header: {
            backgroundColor: '#1b365d',
            padding: '16px 20px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        {selectedDecompte && (
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Code</Text>
                <Text fw={600}>{selectedDecompte.code_decompte || 'N/A'}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Date</Text>
                <Text fw={600}>{formatDateHeure(selectedDecompte.date_decompte)}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Revendeur</Text>
                <Group gap="xs">
                  <IconTruck size={14} color="#868e96" />
                  <Text fw={600}>{selectedDecompte.nom_revendeur || 'Inconnu'}</Text>
                </Group>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Statut</Text>
                <Badge color={getStatutColor(selectedDecompte.statut)} size="lg">
                  {getStatutLabel(selectedDecompte.statut)}
                </Badge>
              </Paper>
            </SimpleGrid>

            <Divider />

            <Title order={5}>Montants</Title>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <Paper withBorder p="md" ta="center" radius="md">
                <Text size="xs" c="dimmed">Achats</Text>
                <Text fw={700} color="red">{formatMontant(selectedDecompte.montant_achat || 0)} FCFA</Text>
              </Paper>
              <Paper withBorder p="md" ta="center" radius="md">
                <Text size="xs" c="dimmed">Ventes</Text>
                <Text fw={700} color="blue">{formatMontant(selectedDecompte.montant_vente || 0)} FCFA</Text>
              </Paper>
              <Paper withBorder p="md" ta="center" radius="md" style={{ backgroundColor: '#e8f5e9' }}>
                <Text size="xs" c="dimmed">Bénéfice</Text>
                <Text fw={700} color="green">{formatMontant(selectedDecompte.montant_benefice || 0)} FCFA</Text>
              </Paper>
              <Paper withBorder p="md" ta="center" radius="md" style={{ backgroundColor: '#f0f5ff' }}>
                <Text size="xs" c="dimmed">Net</Text>
                <Text fw={700} color="blue" size="lg">{formatMontant(selectedDecompte.montant_net || 0)} FCFA</Text>
              </Paper>
            </SimpleGrid>

            {selectedDecompte.observation && (
              <>
                <Divider />
                <div>
                  <Text size="xs" c="dimmed">Observation</Text>
                  <Text>{selectedDecompte.observation}</Text>
                </div>
              </>
            )}

            {selectedDecompte.notes && (
              <>
                <Divider />
                <div>
                  <Text size="xs" c="dimmed">Notes</Text>
                  <Text>{selectedDecompte.notes}</Text>
                </div>
              </>
            )}

            {selectedDecompte.periode_debut && selectedDecompte.periode_fin && (
              <>
                <Divider />
                <SimpleGrid cols={2} spacing="md">
                  <Paper withBorder p="sm" radius="md">
                    <Text size="xs" c="dimmed">Période début</Text>
                    <Text fw={500}>{formatDate(selectedDecompte.periode_debut)}</Text>
                  </Paper>
                  <Paper withBorder p="sm" radius="md">
                    <Text size="xs" c="dimmed">Période fin</Text>
                    <Text fw={500}>{formatDate(selectedDecompte.periode_fin)}</Text>
                  </Paper>
                </SimpleGrid>
              </>
            )}

            <Divider />

            <Group justify="flex-end">
              <Button
                variant="light"
                color="teal"
                leftSection={<IconPrinter size={16} />}
                onClick={() => {
                  setDetailModalOpened(false);
                  handlePrint(selectedDecompte);
                }}
              >
                Imprimer
              </Button>
              <Button variant="light" onClick={() => setDetailModalOpened(false)}>
                Fermer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}