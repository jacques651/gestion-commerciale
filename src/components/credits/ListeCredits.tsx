// src/components/credits/ListeCredits.tsx
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
  Progress,
  Box,
} from '@mantine/core';
import {
  IconCreditCard,
  IconSearch,
  IconRefresh,
  IconPrinter,
  IconPlus,
  IconEye,
  IconReceipt,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMoneybag,
  IconAlertCircle,
  IconX,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { Credit, creditRepository, Remboursement } from '../../database/repositories/creditRepository';

interface Statistiques {
  totalCredits: number;
  totalMontant: number;
  totalRembourse: number;
  totalRestant: number;
  enCours: number;
  termines: number;
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

export default function ListeCredits() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statutFilter, setStatutFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statistiques, setStatistiques] = useState<Statistiques | null>(null);
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [remboursements, setRemboursements] = useState<Remboursement[]>([]);
  const [formModalOpened, setFormModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remboursementModalOpened, setRemboursementModalOpened] = useState(false);
  const [, setViewMode] = useState<'list' | 'details'>('list');

  // Formulaire crédit
  const [creditForm, setCreditForm] = useState({
    designation: '',
    montant_total: 0,
    beneficiaire: '',
    type_credit: 'AUTRE' as 'CLIENT' | 'FOURNISSEUR' | 'AUTRE',
    reference: '',
    notes: '',
    date_echeance: '',
  });

  // Formulaire remboursement
  const [remboursementForm, setRemboursementForm] = useState({
    montant: 0,
    mode_paiement: 'ESPECES' as 'ESPECES' | 'VIREMENT' | 'CHEQUE' | 'MOBILE_MONEY' | 'AUTRE',
    reference_paiement: '',
    notes: '',
  });

  const itemsPerPage = 15;

  useEffect(() => {
    chargerDonnees();
  }, []);

  useEffect(() => {
    let filtered = [...credits];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.beneficiaire.toLowerCase().includes(term) ||
        c.designation.toLowerCase().includes(term) ||
        c.code_credit.toLowerCase().includes(term) ||
        c.reference?.toLowerCase().includes(term)
      );
    }

    if (statutFilter) {
      filtered = filtered.filter(c => c.statut === statutFilter);
    }

    if (typeFilter) {
      filtered = filtered.filter(c => c.type_credit === typeFilter);
    }

    setFilteredCredits(filtered);
    setCurrentPage(1);
  }, [credits, searchTerm, statutFilter, typeFilter]);

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      const data = await creditRepository.getAll();
      setCredits(data);
      await chargerStatistiques();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les crédits',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const chargerStatistiques = async () => {
    try {
      const stats = await creditRepository.getStatistiques();
      setStatistiques(stats);
    } catch (error) {
      console.error('Erreur statistiques:', error);
    }
  };

  const handleAjouterCredit = async () => {
    if (!creditForm.designation || creditForm.montant_total <= 0 || !creditForm.beneficiaire) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez remplir tous les champs obligatoires',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      await creditRepository.createCredit({
        date_credit: new Date().toISOString(),
        date_echeance: creditForm.date_echeance || undefined,
        designation: creditForm.designation,
        montant_total: creditForm.montant_total,
        beneficiaire: creditForm.beneficiaire,
        type_credit: creditForm.type_credit,
        reference: creditForm.reference,
        notes: creditForm.notes,
        statut: 'EN_COURS',
        idJournal: null,
      });

      notifications.show({
        title: 'Crédit enregistré',
        message: 'Le crédit/créance a été ajouté avec succès',
        color: 'green',
      });

      setFormModalOpened(false);
      setCreditForm({
        designation: '',
        montant_total: 0,
        beneficiaire: '',
        type_credit: 'AUTRE',
        reference: '',
        notes: '',
        date_echeance: '',
      });
      chargerDonnees();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible d\'ajouter le crédit',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAjouterRemboursement = async () => {
    if (!selectedCredit) return;

    if (remboursementForm.montant <= 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Le montant du remboursement doit être supérieur à 0',
        color: 'red',
      });
      return;
    }

    if (remboursementForm.montant > (selectedCredit.montant_restant || 0)) {
      notifications.show({
        title: 'Erreur',
        message: `Le montant ne peut pas dépasser le reste à rembourser (${formatMontant(selectedCredit.montant_restant)} FCFA)`,
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      await creditRepository.addRemboursement({
        date_remboursement: new Date().toISOString(),
        idCredit: selectedCredit.idCredit,
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

      setRemboursementModalOpened(false);
      setRemboursementForm({
        montant: 0,
        mode_paiement: 'ESPECES',
        reference_paiement: '',
        notes: '',
      });
      chargerDonnees();
      if (selectedCredit) {
        await voirDetails(selectedCredit.idCredit);
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
      const data = await creditRepository.getCreditAvecRemboursements(id);
      if (data) {
        setSelectedCredit(data);
        setRemboursements(data.remboursements || []);
        setDetailModalOpened(true);
        setViewMode('details');
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

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'EN_COURS':
        return <Badge color="orange" variant="light">🟠 En cours</Badge>;
      case 'TERMINE':
        return <Badge color="green" variant="light">✅ Terminé</Badge>;
      case 'ANNULE':
        return <Badge color="red" variant="light">❌ Annulé</Badge>;
      default:
        return <Badge color="gray">{statut}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'CLIENT':
        return <Badge color="blue" variant="light">👤 Client</Badge>;
      case 'FOURNISSEUR':
        return <Badge color="violet" variant="light">🏢 Fournisseur</Badge>;
      default:
        return <Badge color="gray" variant="light">📌 Autre</Badge>;
    }
  };

  const getModePaiementLabel = (mode: string) => {
    switch (mode) {
      case 'ESPECES': return 'Espèces';
      case 'VIREMENT': return 'Virement';
      case 'CHEQUE': return 'Chèque';
      case 'MOBILE_MONEY': return 'Mobile Money';
      default: return 'Autre';
    }
  };

  const totalPages = Math.ceil(filteredCredits.length / itemsPerPage);
  const paginatedCredits = filteredCredits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const pourcentageRemboursement = (credit: Credit) => {
    if (credit.montant_total === 0) return 0;
    return ((credit.montant_total - credit.montant_restant) / credit.montant_total) * 100;
  };

  if (loading && credits.length === 0) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* En-tête */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderBottom: '3px solid #e94560' }}>
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={45} radius="md" color="violet" variant="filled">
              <IconCreditCard size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Suivi des Crédits</Title>
              <Text c="gray.3" size="sm">
                Gestion des crédits clients, fournisseurs et autres
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={chargerDonnees}
            >
              Actualiser
            </Button>
            <Button
              variant="filled"
              color="green"
              leftSection={<IconPlus size={18} />}
              onClick={() => setFormModalOpened(true)}
            >
              Nouveau crédit
            </Button>
          </Group>
        </Flex>

        <SimpleGrid cols={{ base: 2, sm: 6 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconCreditCard size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Total crédits</Text>
                <Text c="white" fw={700} size="xl">{statistiques?.totalCredits || 0}</Text>
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
                <Text c="white" fw={700} size="lg">{formatMontant(statistiques?.totalMontant || 0)}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(46,125,50,0.3)' }}>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconArrowUpRight size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Remboursé</Text>
                <Text c="white" fw={700} size="lg">{formatMontant(statistiques?.totalRembourse || 0)}</Text>
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
                <Text c="white" fw={700} size="lg">{formatMontant(statistiques?.totalRestant || 0)}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(255, 165, 0, 0.2)' }}>
            <Group>
              <ThemeIcon color="orange" variant="light" size="lg">
                <IconAlertCircle size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">En cours</Text>
                <Text c="white" fw={700} size="xl">{statistiques?.enCours || 0}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconCheck size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Terminés</Text>
                <Text c="white" fw={700} size="xl">{statistiques?.termines || 0}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Filtres */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Flex align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            placeholder="Rechercher par bénéficiaire, désignation..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="sm"
            style={{ flex: 2, minWidth: 200 }}
            label="Recherche"
          />
          <Select
            placeholder="Statut"
            clearable
            data={[
              { value: 'EN_COURS', label: 'En cours' },
              { value: 'TERMINE', label: 'Terminé' },
              { value: 'ANNULE', label: 'Annulé' }
            ]}
            value={statutFilter}
            onChange={setStatutFilter}
            size="sm"
            style={{ flex: 1, minWidth: 140 }}
            label="Statut"
          />
          <Select
            placeholder="Type"
            clearable
            data={[
              { value: 'CLIENT', label: 'Vente à crédit' },
              { value: 'FOURNISSEUR', label: 'Avance / Prêt accordé' },
              { value: 'AUTRE', label: '📌 Autre' }
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            size="sm"
            style={{ flex: 1, minWidth: 140 }}
            label="Type"
          />
          <Tooltip label="Réinitialiser">
            <ActionIcon
              variant="light"
              color="red"
              onClick={() => {
                setSearchTerm('');
                setStatutFilter(null);
                setTypeFilter(null);
              }}
              size={36}
              style={{ marginTop: 18 }}
            >
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Flex>

        {filteredCredits.length > 0 && (
          <Text size="xs" c="dimmed" mt="xs">
            {filteredCredits.length} crédit(s) trouvé(s)
          </Text>
        )}
      </Card>

      {/* Liste des crédits */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <ScrollArea h={500}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                <Table.Th c="white" w={50}>N°</Table.Th>
                <Table.Th c="white">Code</Table.Th>
                <Table.Th c="white">Date</Table.Th>
                <Table.Th c="white">Désignation</Table.Th>
                <Table.Th c="white">Bénéficiaire</Table.Th>
                <Table.Th c="white">Type</Table.Th>
                <Table.Th c="white" ta="right">Montant</Table.Th>
                <Table.Th c="white" ta="right">Reste</Table.Th>
                <Table.Th c="white" ta="center">Progression</Table.Th>
                <Table.Th c="white" ta="center">Statut</Table.Th>
                <Table.Th c="white" ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedCredits.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={11} align="center">
                    <Text c="dimmed" py={40}>
                      {searchTerm || statutFilter || typeFilter ? 'Aucun crédit ne correspond aux filtres' : 'Aucun crédit enregistré'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                paginatedCredits.map((credit, idx) => {
                  const num = (currentPage - 1) * itemsPerPage + idx + 1;
                  const progress = pourcentageRemboursement(credit);
                  return (
                    <Table.Tr key={credit.idCredit}>
                      <Table.Td fw={600}>{num}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue" size="sm">
                          {credit.code_credit}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{formatDate(credit.date_credit)}</Table.Td>
                      <Table.Td>
                        <Text fw={500} size="sm">{credit.designation}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>{credit.beneficiaire}</Text>
                      </Table.Td>
                      <Table.Td>{getTypeBadge(credit.type_credit)}</Table.Td>
                      <Table.Td ta="right">
                        <Text fw={600}>{formatMontant(credit.montant_total)}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fw={600} c={credit.montant_restant > 0 ? 'orange' : 'green'}>
                          {formatMontant(credit.montant_restant)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="center" style={{ minWidth: 80 }}>
                        <Box style={{ width: 80 }}>
                          <Progress 
                            value={progress} 
                            color={progress === 100 ? 'green' : progress > 50 ? 'orange' : 'red'}
                            size="sm"
                          />
                          <Text size="xs" c="dimmed" mt={2}>
                            {Math.round(progress)}%
                          </Text>
                        </Box>
                      </Table.Td>
                      <Table.Td ta="center">{getStatutBadge(credit.statut)}</Table.Td>
                      <Table.Td ta="center">
                        <Group gap="xs" justify="center">
                          <Tooltip label="Voir détails">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => voirDetails(credit.idCredit)}
                              size={30}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {credit.statut === 'EN_COURS' && (
                            <Tooltip label="Ajouter remboursement">
                              <ActionIcon
                                variant="light"
                                color="green"
                                onClick={() => {
                                  voirDetails(credit.idCredit);
                                  setTimeout(() => setRemboursementModalOpened(true), 300);
                                }}
                                size={30}
                              >
                                <IconReceipt size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
          </Group>
        )}
      </Card>

      {/* Modal Ajout Crédit */}
      <Modal
        opened={formModalOpened}
        onClose={() => setFormModalOpened(false)}
        title="Nouveau crédit"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1a1a2e', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Désignation *"
            placeholder="Ex: Achat marchandises"
            value={creditForm.designation}
            onChange={(e) => setCreditForm({ ...creditForm, designation: e.target.value })}
            required
          />

          <NumberInput
            label="Montant total *"
            placeholder="0"
            value={creditForm.montant_total}
            onChange={(val) => setCreditForm({ ...creditForm, montant_total: typeof val === 'number' ? val : 0 })}
            min={0}
            step={100}
            required
            leftSection="FCFA"
            thousandSeparator=" "
          />

          <TextInput
            label="Débiteur / Créancier *"
            placeholder="Nom de la personne ou entité (client, ami, fournisseur...)"
            description="Peut être n'importe qui — pas obligatoirement un client enregistré"
            value={creditForm.beneficiaire}
            onChange={(e) => setCreditForm({ ...creditForm, beneficiaire: e.target.value })}
            required
          />

          <Select
            label="Nature du crédit"
            description="Choisissez la catégorie qui correspond le mieux"
            data={[
              { value: 'CLIENT', label: 'Vente à crédit (client)' },
              { value: 'FOURNISSEUR', label: 'Avance ou prêt accordé' },
              { value: 'AUTRE', label: 'Créance diverse / autre' },
            ]}
            value={creditForm.type_credit}
            onChange={(value) => setCreditForm({ ...creditForm, type_credit: (value as any) || 'AUTRE' })}
          />

          <TextInput
            label="Date d'échéance"
            placeholder="JJ/MM/AAAA"
            description="Date limite de remboursement (optionnel)"
            value={creditForm.date_echeance}
            onChange={(e) => setCreditForm({ ...creditForm, date_echeance: e.target.value })}
          />

          <TextInput
            label="Référence"
            placeholder="N° de facture, bon de commande, contrat..."
            value={creditForm.reference}
            onChange={(e) => setCreditForm({ ...creditForm, reference: e.target.value })}
          />

          <Textarea
            label="Notes"
            placeholder="Contexte, conditions de remboursement, remarques..."
            value={creditForm.notes}
            onChange={(e) => setCreditForm({ ...creditForm, notes: e.target.value })}
            rows={3}
          />

          <Divider />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setFormModalOpened(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAjouterCredit}
              loading={saving}
              color="blue"
              leftSection={<IconPlus size={16} />}
            >
              Enregistrer le crédit
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Détails */}
      <Modal
        opened={detailModalOpened}
        onClose={() => {
          setDetailModalOpened(false);
          setViewMode('list');
        }}
        title="Détails du crédit"
        size="xl"
        centered
      >
        {selectedCredit && (
          <Stack gap="md">
            {/* Informations du crédit */}
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Code</Text>
                <Text fw={600}>{selectedCredit.code_credit}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Date</Text>
                <Text fw={600}>{formatDate(selectedCredit.date_credit)}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Désignation</Text>
                <Text fw={600}>{selectedCredit.designation}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Bénéficiaire</Text>
                <Text fw={600}>{selectedCredit.beneficiaire}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Type</Text>
                {getTypeBadge(selectedCredit.type_credit)}
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Statut</Text>
                {getStatutBadge(selectedCredit.statut)}
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="sm" c="dimmed">Montant total</Text>
                <Text fw={700} size="lg">{formatMontant(selectedCredit.montant_total)} FCFA</Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="sm" c="dimmed">Total remboursé</Text>
                <Text fw={700} size="lg" c="green">{formatMontant(selectedCredit.montant_total - selectedCredit.montant_restant)} FCFA</Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="sm" c="dimmed">Reste à rembourser</Text>
                <Text fw={700} size="lg" c={selectedCredit.montant_restant > 0 ? 'orange' : 'green'}>
                  {formatMontant(selectedCredit.montant_restant)} FCFA
                </Text>
              </Grid.Col>
              {selectedCredit.reference && (
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">Référence</Text>
                  <Text>{selectedCredit.reference}</Text>
                </Grid.Col>
              )}
              {selectedCredit.notes && (
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">Notes</Text>
                  <Text>{selectedCredit.notes}</Text>
                </Grid.Col>
              )}
            </Grid>

            <Divider label="Progression" />
            
            <Box>
              <Group justify="space-between">
                <Text size="sm">Avancement</Text>
                <Text size="sm" fw={600}>
                  {Math.round(pourcentageRemboursement(selectedCredit))}%
                </Text>
              </Group>
              <Progress 
                value={pourcentageRemboursement(selectedCredit)} 
                color={selectedCredit.montant_restant === 0 ? 'green' : 'blue'}
                size="lg"
                radius="xl"
              />
            </Box>

            <Divider label="Historique des remboursements" />

            {/* Liste des remboursements */}
            {selectedCredit.statut === 'EN_COURS' && (
              <Button
                variant="filled"
                color="green"
                leftSection={<IconPlus size={16} />}
                onClick={() => setRemboursementModalOpened(true)}
              >
                Ajouter un remboursement
              </Button>
            )}

            {remboursements.length === 0 ? (
              <Alert color="gray" variant="light">
                Aucun remboursement enregistré pour ce crédit
              </Alert>
            ) : (
              <ScrollArea h={200}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Montant</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th>Référence</Table.Th>
                      <Table.Th>Notes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {remboursements.map((r) => (
                      <Table.Tr key={r.idRemboursement}>
                        <Table.Td>{formatDate(r.date_remboursement)}</Table.Td>
                        <Table.Td>
                          <Text fw={600} c="green">+{formatMontant(r.montant)} FCFA</Text>
                        </Table.Td>
                        <Table.Td>{getModePaiementLabel(r.mode_paiement)}</Table.Td>
                        <Table.Td>{r.reference_paiement || '-'}</Table.Td>
                        <Table.Td>{r.notes || '-'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}

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

      {/* Modal Ajout Remboursement */}
      <Modal
        opened={remboursementModalOpened}
        onClose={() => setRemboursementModalOpened(false)}
        title="Ajouter un remboursement"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1a1a2e', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          {selectedCredit && (
            <Alert color="blue" variant="light">
              <Group justify="space-between">
                <Text size="sm">Crédit: {selectedCredit.code_credit}</Text>
                <Text size="sm" fw={600}>
                  Reste à rembourser: {formatMontant(selectedCredit.montant_restant)} FCFA
                </Text>
              </Group>
            </Alert>
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
              { value: 'ESPECES', label: 'Espèces' },
              { value: 'VIREMENT', label: 'Virement' },
              { value: 'CHEQUE', label: 'Chèque' },
              { value: 'MOBILE_MONEY', label: 'Mobile Money' },
              { value: 'AUTRE', label: 'Autre' }
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
            placeholder="Notes sur ce remboursement..."
            value={remboursementForm.notes}
            onChange={(e) => setRemboursementForm({ ...remboursementForm, notes: e.target.value })}
            rows={3}
          />

          <Divider />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setRemboursementModalOpened(false)}>
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

    </Stack>
  );
}

