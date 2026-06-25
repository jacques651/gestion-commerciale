// src/components/credits/RemboursementsList.tsx
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
  Modal,
  Pagination,
  Flex,
  Grid,
  ActionIcon,
  Tooltip,
  ScrollArea,
  Select,
  NumberInput,
  Textarea,
  Divider,
  Alert,
} from '@mantine/core';
import {
  IconReceipt,
  IconSearch,
  IconRefresh,
  IconPrinter,
  IconPlus,
  IconEye,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMoneybag,
  IconAlertCircle,
  IconX,
  IconCheck,
  IconCreditCard,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { creditRepository, Credit, Remboursement } from '../../database/repositories/creditRepository';

interface RemboursementsListProps {
  creditId?: number;
  onClose?: () => void;
}

// ✅ Fonction de formatage de date personnalisée (sans date-fns)
const formatDateCustom = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
};

export default function RemboursementsList({ creditId }: RemboursementsListProps) {
  const [remboursements, setRemboursements] = useState<Remboursement[]>([]);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formModalOpened, setFormModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [selectedRemboursement, setSelectedRemboursement] = useState<Remboursement | null>(null);
  const [creditsList, setCreditsList] = useState<Credit[]>([]);
  const [selectedCreditId, setSelectedCreditId] = useState<number | null>(creditId || null);

  // Formulaire remboursement
  const [remboursementForm, setRemboursementForm] = useState({
    montant: 0,
    mode_paiement: 'ESPECES' as 'ESPECES' | 'VIREMENT' | 'CHEQUE' | 'MOBILE_MONEY' | 'AUTRE',
    reference_paiement: '',
    notes: '',
    idCredit: 0,
  });

  const itemsPerPage = 15;

  useEffect(() => {
    chargerCredits();
    if (creditId) {
      setSelectedCreditId(creditId);
    }
  }, [creditId]);

  useEffect(() => {
    if (selectedCreditId) {
      chargerRemboursements(selectedCreditId);
      chargerCredit(selectedCreditId);
    }
  }, [selectedCreditId]);

  const chargerCredits = async () => {
    try {
      const data = await creditRepository.getAll();
      setCreditsList(data);
    } catch (error) {
      console.error('Erreur chargement crédits:', error);
    }
  };

  const chargerCredit = async (id: number) => {
    try {
      const data = await creditRepository.getById(id);
      if (data) {
        setCredit(data);
      }
    } catch (error) {
      console.error('Erreur chargement crédit:', error);
    }
  };

  const chargerRemboursements = async (id: number) => {
    setLoading(true);
    try {
      const data = await creditRepository.getRemboursementsByCredit(id);
      setRemboursements(data);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les remboursements',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAjouterRemboursement = async () => {
    if (!selectedCreditId) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez sélectionner un crédit',
        color: 'red',
      });
      return;
    }

    if (remboursementForm.montant <= 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Le montant du remboursement doit être supérieur à 0',
        color: 'red',
      });
      return;
    }

    if (credit && remboursementForm.montant > (credit.montant_restant || 0)) {
      notifications.show({
        title: 'Erreur',
        message: `Le montant ne peut pas dépasser le reste à rembourser (${formatMontant(credit.montant_restant)} FCFA)`,
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      await creditRepository.addRemboursement({
        date_remboursement: new Date().toISOString(),
        idCredit: selectedCreditId,
        montant: remboursementForm.montant,
        mode_paiement: remboursementForm.mode_paiement,
        reference_paiement: remboursementForm.reference_paiement,
        notes: remboursementForm.notes,
        idJournal: null,
      });

      notifications.show({
        title: '✅ Succès',
        message: `Remboursement de ${formatMontant(remboursementForm.montant)} FCFA enregistré`,
        color: 'green',
      });

      setFormModalOpened(false);
      setRemboursementForm({
        montant: 0,
        mode_paiement: 'ESPECES',
        reference_paiement: '',
        notes: '',
        idCredit: 0,
      });
      
      if (selectedCreditId) {
        chargerRemboursements(selectedCreditId);
        chargerCredit(selectedCreditId);
      }
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible d\'ajouter le remboursement',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const voirDetails = async (id: number) => {
    try {
      const data = await creditRepository.getRemboursementsByCredit(id);
      const remb = data.find(r => r.idRemboursement === id);
      if (remb) {
        setSelectedRemboursement(remb);
        setDetailModalOpened(true);
      }
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les détails',
        color: 'red',
      });
    }
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  // ✅ Utiliser formatDateCustom au lieu de format de date-fns
  const formatDate = (dateStr: string): string => {
    return formatDateCustom(dateStr);
  };

  const getModePaiementBadge = (mode: string) => {
    switch (mode) {
      case 'ESPECES':
        return <Badge color="green" variant="light">💰 Espèces</Badge>;
      case 'VIREMENT':
        return <Badge color="blue" variant="light">🏦 Virement</Badge>;
      case 'CHEQUE':
        return <Badge color="orange" variant="light">📝 Chèque</Badge>;
      case 'MOBILE_MONEY':
        return <Badge color="violet" variant="light">📱 Mobile Money</Badge>;
      default:
        return <Badge color="gray" variant="light">📌 Autre</Badge>;
    }
  };

  const filteredRemboursements = remboursements.filter(r => {
    let match = true;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      match = match && (
        r.code_remboursement.toLowerCase().includes(term) ||
        r.reference_paiement?.toLowerCase().includes(term) ||
        r.notes?.toLowerCase().includes(term)
      );
    }
    if (modeFilter) {
      match = match && r.mode_paiement === modeFilter;
    }
    return match;
  });

  const totalPages = Math.ceil(filteredRemboursements.length / itemsPerPage);
  const paginatedRemboursements = filteredRemboursements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalRembourse = remboursements.reduce((sum, r) => sum + r.montant, 0);

  if (loading && remboursements.length === 0) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
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
              <Title order={1} c="white">Remboursements</Title>
              <Text c="gray.3" size="sm">
                Suivi des remboursements de crédits
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={() => selectedCreditId && chargerRemboursements(selectedCreditId)}
              disabled={!selectedCreditId}
            >
              Actualiser
            </Button>
            <Button
              variant="filled"
              color="green"
              leftSection={<IconPlus size={18} />}
              onClick={() => setFormModalOpened(true)}
              disabled={!selectedCreditId || (credit?.statut === 'TERMINE')}
            >
              Nouveau remboursement
            </Button>
          </Group>
        </Flex>

        {/* Statistiques */}
        {credit && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconCreditCard size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Crédit</Text>
                  <Text c="white" fw={700} size="md">{credit.code_credit}</Text>
                  <Text c="gray.3" size="xs">{credit.designation}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(74, 108, 247, 0.3)' }}>
              <Group>
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconMoneybag size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Montant total</Text>
                  <Text c="white" fw={700} size="xl">{formatMontant(credit.montant_total)}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(46,125,50,0.3)' }}>
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconArrowUpRight size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Total remboursé</Text>
                  <Text c="white" fw={700} size="xl">{formatMontant(totalRembourse)}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(211,47,47,0.3)' }}>
              <Group>
                <ThemeIcon color="red" variant="light" size="lg">
                  <IconArrowDownRight size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Reste à rembourser</Text>
                  <Text c="white" fw={700} size="xl">{formatMontant(credit.montant_restant)}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        )}

        {!credit && !creditId && (
          <Alert color="yellow" variant="light" mt="md">
            <Group>
              <IconAlertCircle size={20} />
              <Text>Aucun crédit sélectionné. Veuillez sélectionner un crédit pour voir ses remboursements.</Text>
            </Group>
          </Alert>
        )}
      </Paper>

      {/* Sélection du crédit (si pas de creditId passé en props) */}
      {!creditId && (
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Select
            label="Sélectionner un crédit"
            placeholder="Choisissez un crédit"
            searchable
            clearable
            data={creditsList
              .filter(c => c.statut === 'EN_COURS' || c.statut === 'TERMINE')
              .map(c => ({
                value: c.idCredit.toString(),
                label: `${c.code_credit} - ${c.designation} (${c.beneficiaire}) - ${formatMontant(c.montant_restant)} FCFA restant`,
              }))}
            value={selectedCreditId?.toString() || null}
            onChange={(value) => {
              if (value) {
                setSelectedCreditId(Number(value));
              } else {
                setSelectedCreditId(null);
                setRemboursements([]);
                setCredit(null);
              }
            }}
            size="md"
          />
        </Card>
      )}

      {/* Filtres */}
      {selectedCreditId && (
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Flex align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              placeholder="Rechercher par référence..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="sm"
              style={{ flex: 2, minWidth: 200 }}
              label="Recherche"
            />
            <Select
              placeholder="Mode de paiement"
              clearable
              data={[
                { value: 'ESPECES', label: '💰 Espèces' },
                { value: 'VIREMENT', label: '🏦 Virement' },
                { value: 'CHEQUE', label: '📝 Chèque' },
                { value: 'MOBILE_MONEY', label: '📱 Mobile Money' },
                { value: 'AUTRE', label: '📌 Autre' }
              ]}
              value={modeFilter}
              onChange={setModeFilter}
              size="sm"
              style={{ flex: 1, minWidth: 140 }}
              label="Mode de paiement"
            />
            <Tooltip label="Réinitialiser">
              <ActionIcon
                variant="light"
                color="red"
                onClick={() => {
                  setSearchTerm('');
                  setModeFilter(null);
                }}
                size={36}
                style={{ marginTop: 18 }}
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Flex>

          {filteredRemboursements.length > 0 && (
            <Text size="xs" c="dimmed" mt="xs">
              {filteredRemboursements.length} remboursement(s) trouvé(s)
            </Text>
          )}
        </Card>
      )}

      {/* Liste des remboursements */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        {!selectedCreditId ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <IconReceipt size={48} color="#868e96" />
              <Text c="dimmed" size="lg" fw={500}>
                Veuillez sélectionner un crédit
              </Text>
              <Text c="dimmed" size="sm">
                Pour voir l'historique des remboursements
              </Text>
            </Stack>
          </Center>
        ) : loading ? (
          <Center py={100}>
            <Loader size="xl" />
          </Center>
        ) : filteredRemboursements.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <IconReceipt size={48} color="#868e96" />
              <Text c="dimmed" size="lg" fw={500}>
                Aucun remboursement
              </Text>
              <Text c="dimmed" size="sm">
                {searchTerm || modeFilter ? 'Aucun remboursement ne correspond aux filtres' : 'Aucun remboursement enregistré pour ce crédit'}
              </Text>
              {(searchTerm || modeFilter) && (
                <Button variant="subtle" size="xs" onClick={() => {
                  setSearchTerm('');
                  setModeFilter(null);
                }}>
                  Réinitialiser les filtres
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <>
            <ScrollArea h={450}>
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                    <Table.Th c="white" w={50}>N°</Table.Th>
                    <Table.Th c="white">Code</Table.Th>
                    <Table.Th c="white">Date</Table.Th>
                    <Table.Th c="white" ta="right">Montant</Table.Th>
                    <Table.Th c="white">Mode de paiement</Table.Th>
                    <Table.Th c="white">Référence</Table.Th>
                    <Table.Th c="white">Notes</Table.Th>
                    <Table.Th c="white" ta="center">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedRemboursements.map((remb, idx) => {
                    const num = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <Table.Tr key={remb.idRemboursement}>
                        <Table.Td fw={600}>{num}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="teal" size="sm">
                            {remb.code_remboursement}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{formatDate(remb.date_remboursement)}</Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} c="green">
                            +{formatMontant(remb.montant)} FCFA
                          </Text>
                        </Table.Td>
                        <Table.Td>{getModePaiementBadge(remb.mode_paiement)}</Table.Td>
                        <Table.Td>
                          <Text size="sm">{remb.reference_paiement || '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {remb.notes || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Tooltip label="Voir détails">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => voirDetails(remb.idRemboursement)}
                              size={30}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {totalPages > 1 && (
              <Group justify="center" p="md">
                <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
              </Group>
            )}
          </>
        )}
      </Card>

      {/* Modal Ajout Remboursement */}
      <Modal
        opened={formModalOpened}
        onClose={() => setFormModalOpened(false)}
        title="Nouveau remboursement"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          {credit && (
            <Alert color="blue" variant="light">
              <Group justify="space-between">
                <Text size="sm">Crédit: {credit.code_credit}</Text>
                <Text size="sm" fw={600}>
                  Reste à rembourser: {formatMontant(credit.montant_restant)} FCFA
                </Text>
              </Group>
              <Text size="xs" c="dimmed" mt="xs">
                {credit.designation} - {credit.beneficiaire}
              </Text>
            </Alert>
          )}

          {!creditId && (
            <Select
              label="Crédit *"
              placeholder="Sélectionner un crédit"
              searchable
              required
              data={creditsList
                .filter(c => c.statut === 'EN_COURS')
                .map(c => ({
                  value: c.idCredit.toString(),
                  label: `${c.code_credit} - ${c.designation} (${formatMontant(c.montant_restant)} FCFA restant)`,
                }))}
              value={remboursementForm.idCredit ? remboursementForm.idCredit.toString() : null}
              onChange={(value) => {
                if (value) {
                  setRemboursementForm({ ...remboursementForm, idCredit: Number(value) });
                  const credit = creditsList.find(c => c.idCredit === Number(value));
                  if (credit) {
                    setCredit(credit);
                  }
                }
              }}
            />
          )}

          <NumberInput
            label="Montant du remboursement *"
            placeholder="0"
            value={remboursementForm.montant}
            onChange={(val) => setRemboursementForm({ ...remboursementForm, montant: typeof val === 'number' ? val : 0 })}
            min={0}
            step={100}
            required
            leftSection="FCFA"
            thousandSeparator=" "
          />

          <Select
            label="Mode de paiement *"
            data={[
              { value: 'ESPECES', label: '💰 Espèces' },
              { value: 'VIREMENT', label: '🏦 Virement' },
              { value: 'CHEQUE', label: '📝 Chèque' },
              { value: 'MOBILE_MONEY', label: '📱 Mobile Money' },
              { value: 'AUTRE', label: '📌 Autre' }
            ]}
            value={remboursementForm.mode_paiement}
            onChange={(value) => setRemboursementForm({ ...remboursementForm, mode_paiement: (value as any) || 'ESPECES' })}
            required
          />

          <TextInput
            label="Référence de paiement"
            placeholder="N° de chèque, virement..."
            value={remboursementForm.reference_paiement}
            onChange={(e) => setRemboursementForm({ ...remboursementForm, reference_paiement: e.target.value })}
          />

          <Textarea
            label="Notes"
            placeholder="Informations complémentaires"
            value={remboursementForm.notes}
            onChange={(e) => setRemboursementForm({ ...remboursementForm, notes: e.target.value })}
            rows={3}
          />

          <Divider />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setFormModalOpened(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAjouterRemboursement}
              loading={saving}
              color="green"
              leftSection={<IconCheck size={16} />}
            >
              Enregistrer le remboursement
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Détails Remboursement */}
      <Modal
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        title="Détails du remboursement"
        size="md"
        centered
      >
        {selectedRemboursement && (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Code</Text>
                <Text fw={600}>{selectedRemboursement.code_remboursement}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Date</Text>
                <Text fw={600}>{formatDate(selectedRemboursement.date_remboursement)}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Montant</Text>
                <Text fw={600} c="green" size="lg">
                  +{formatMontant(selectedRemboursement.montant)} FCFA
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Mode de paiement</Text>
                {getModePaiementBadge(selectedRemboursement.mode_paiement)}
              </Grid.Col>
              {selectedRemboursement.reference_paiement && (
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">Référence</Text>
                  <Text>{selectedRemboursement.reference_paiement}</Text>
                </Grid.Col>
              )}
              {selectedRemboursement.notes && (
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">Notes</Text>
                  <Text>{selectedRemboursement.notes}</Text>
                </Grid.Col>
              )}
            </Grid>

            <Divider />

            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setDetailModalOpened(false)}>
                Fermer
              </Button>
              <Button
                variant="light"
                color="blue"
                leftSection={<IconPrinter size={16} />}
                onClick={() => {
                  notifications.show({
                    title: 'Information',
                    message: 'Impression en cours de développement',
                    color: 'blue',
                  });
                }}
              >
                Imprimer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}