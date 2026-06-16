// src/components/reglements/ListeReglements.tsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table, ActionIcon,
  Box, Pagination, Tooltip, Modal, Divider, ThemeIcon,
  SimpleGrid, Select, TextInput, Avatar, Badge, Flex, Paper, 
  Loader, Center} from '@mantine/core';
import {
  IconSearch, IconRefresh,
  IconCalendar, IconCash, IconPrinter, IconEye,
  IconPlus, IconX} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useReactToPrint } from 'react-to-print';
import { FormulaireReglement } from './FormulaireReglement';
import { ReçuReglement } from './ReçuReglement';

interface Reglement {
  idReglement: number;
  code_reglement: string;
  idClient: number;
  client_nom: string;
  client_societe: string;
  idFacture: number;
  code_facture: string;
  date_reglement: string;
  montant: number;
  mode_reglement: string;
  reference: string;
  observation: string;
}

interface ReglementWithCumul extends Reglement {
  cumul: number;
  reste: number;
  montant_total_facture: number;
  statut_paiement: 'payee' | 'partielle' | 'non_payee';
}

const ListeReglements: React.FC = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const [reglements, setReglements] = useState<ReglementWithCumul[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [clientFiltre, setClientFiltre] = useState<string | null>(null);
  const [statutFiltre, setStatutFiltre] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedReglement, setSelectedReglement] = useState<ReglementWithCumul | null>(null);
  const [clients, setClients] = useState<{ value: string; label: string }[]>([]);
  const [reglementModalOpened, setReglementModalOpened] = useState(false);
  const [selectedFactureId, setSelectedFactureId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedMontantMax, setSelectedMontantMax] = useState<number>(0);
  const [reçuModalOpened, setReçuModalOpened] = useState(false);
  const [selectedReglementForReçu, setSelectedReglementForReçu] = useState<any>(null);
  const [] = useState(false);
  const [stats, setStats] = useState({
    totalReglements: 0,
    totalMontant: 0,
    totalClients: 0,
    payees: 0,
    partielles: 0,
    nonPayees: 0
  });

  const itemsPerPage = 10;

  const chargerReglements = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      
      const result = await db.select<any[]>(`
        SELECT 
          r.idReglement,
          r.code_reglement,
          r.idClient,
          r.idFacture,
          r.date_reglement,
          r.montant,
          r.mode_reglement,
          r.reference,
          r.observation,
          c.NomComplet as client_nom,
          c.Societe as client_societe,
          f.code_facture,
          f.montant_ttc as montant_total_facture
        FROM reglements r
        LEFT JOIN clients c ON c.idClient = r.idClient
        LEFT JOIN factures f ON f.idFacture = r.idFacture
        ORDER BY r.date_reglement DESC, r.idReglement DESC
      `);
      
      const factureMap = new Map<number, { reglements: any[], total: number }>();
      
      for (const reg of result) {
        if (!factureMap.has(reg.idFacture)) {
          factureMap.set(reg.idFacture, { reglements: [], total: 0 });
        }
        const entry = factureMap.get(reg.idFacture)!;
        entry.reglements.push(reg);
        entry.total += reg.montant;
      }
      
      const reglementsWithCumul = result.map(reg => {
        const factureRegs = factureMap.get(reg.idFacture)?.reglements || [];
        const index = factureRegs.findIndex(r => r.idReglement === reg.idReglement);
        const cumul = factureRegs.slice(0, index + 1).reduce((sum, r) => sum + r.montant, 0);
        const totalFacture = reg.montant_total_facture || cumul;
        const reste = totalFacture - cumul;
        
        let statut: 'payee' | 'partielle' | 'non_payee' = 'non_payee';
        if (reste <= 0) statut = 'payee';
        else if (cumul > 0 && reste > 0) statut = 'partielle';
        
        return {
          ...reg,
          cumul,
          reste,
          montant_total_facture: totalFacture,
          statut_paiement: statut
        };
      });
      
      setReglements(reglementsWithCumul);
      
      const uniqueClients = [...new Map(reglementsWithCumul.map(r => [r.idClient, {
        value: r.idClient.toString(),
        label: r.client_nom || r.client_societe || 'Client inconnu'
      }])).values()];
      setClients(uniqueClients);
      
      const totalMontant = reglementsWithCumul.reduce((sum, r) => sum + (r.montant || 0), 0);
      const totalClients = new Set(reglementsWithCumul.map(r => r.idClient)).size;
      const payees = reglementsWithCumul.filter(r => r.statut_paiement === 'payee').length;
      const partielles = reglementsWithCumul.filter(r => r.statut_paiement === 'partielle').length;
      const nonPayees = reglementsWithCumul.filter(r => r.statut_paiement === 'non_payee').length;
      
      setStats({
        totalReglements: reglementsWithCumul.length,
        totalMontant,
        totalClients,
        payees,
        partielles,
        nonPayees
      });
      
    } catch (error) {
      console.error("Erreur chargement règlements:", error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors du chargement des règlements',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerReglements();
  }, []);

  // Filtrage
  const reglementsFiltres = useMemo(() => {
    let filtered = [...reglements];

    // Recherche
    if (recherche) {
      filtered = filtered.filter(r =>
        r.code_reglement?.toLowerCase().includes(recherche.toLowerCase()) ||
        r.client_nom?.toLowerCase().includes(recherche.toLowerCase()) ||
        r.client_societe?.toLowerCase().includes(recherche.toLowerCase()) ||
        r.code_facture?.toLowerCase().includes(recherche.toLowerCase())
      );
    }

    // Client
    if (clientFiltre) {
      filtered = filtered.filter(r => r.idClient?.toString() === clientFiltre);
    }

    // Statut
    if (statutFiltre) {
      filtered = filtered.filter(r => r.statut_paiement === statutFiltre);
    }

    // Date début
    if (dateDebut) {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => new Date(r.date_reglement) >= debut);
    }

    // Date fin
    if (dateFin) {
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.date_reglement) <= fin);
    }

    return filtered;
  }, [reglements, recherche, clientFiltre, statutFiltre, dateDebut, dateFin]);

  const totalPages = Math.ceil(reglementsFiltres.length / itemsPerPage);
  const paginatedData = reglementsFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Statistiques filtrées
  const filteredStats = {
    total: reglementsFiltres.length,
    montant: reglementsFiltres.reduce((sum, r) => sum + (r.montant || 0), 0),
    payees: reglementsFiltres.filter(r => r.statut_paiement === 'payee').length,
    partielles: reglementsFiltres.filter(r => r.statut_paiement === 'partielle').length,
    nonPayees: reglementsFiltres.filter(r => r.statut_paiement === 'non_payee').length
  };

  const resetFilters = () => {
    setRecherche("");
    setClientFiltre(null);
    setStatutFiltre(null);
    setDateDebut("");
    setDateFin("");
    setCurrentPage(1);
  };

  // Impression de la liste
  const handlePrintList = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Liste_Reglements_${format(new Date(), 'dd-MM-yyyy')}`,
  });

  const handleViewDetails = (reglement: ReglementWithCumul) => {
    setSelectedReglement(reglement);
    setDetailsModalOpen(true);
  };

  const handlePrintReçu = async (reglement: ReglementWithCumul) => {
    setSelectedReglementForReçu({
      code_reglement: reglement.code_reglement,
      date_reglement: reglement.date_reglement,
      montant: reglement.montant,
      mode_reglement: reglement.mode_reglement,
      reference: reglement.reference,
      observation: reglement.observation,
      client_nom: reglement.client_nom || reglement.client_societe,
      code_facture: reglement.code_facture,
      idFacture: reglement.idFacture
    });
    setReçuModalOpened(true);
  };

  const handleOpenReglement = async (factureId: number, clientId: number, factureCode: string) => {
    try {
      const db = await getDb();
      
      const facture = await db.select<any[]>(`
        SELECT montant_ttc, COALESCE(montant_regle, 0) as montant_regle
        FROM factures 
        WHERE idFacture = ?
      `, [factureId]);
      
      if (facture.length === 0) {
        notifications.show({
          title: 'Erreur',
          message: 'Facture non trouvée',
          color: 'red',
        });
        return;
      }
      
      const reglementsTotal = await db.select<any[]>(`
        SELECT COALESCE(SUM(montant), 0) as total
        FROM reglements 
        WHERE idFacture = ?
      `, [factureId]);
      
      const montantTotal = facture[0].montant_ttc;
      const totalRegle = Math.max(facture[0].montant_regle, reglementsTotal[0].total);
      const montantRestant = montantTotal - totalRegle;
      
      if (montantRestant <= 0) {
        notifications.show({
          title: 'Information',
          message: `La facture ${factureCode} est déjà entièrement réglée`,
          color: 'blue',
        });
        chargerReglements();
        return;
      }
      
      setSelectedFactureId(factureId);
      setSelectedClientId(clientId);
      setSelectedMontantMax(montantRestant);
      setReglementModalOpened(true);
      
    } catch (error) {
      console.error('Erreur:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les informations de la facture',
        color: 'red',
      });
    }
  };

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: fr });
    } catch {
      return '-';
    }
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'payee':
        return <Badge color="green" variant="filled" size="sm">Payée</Badge>;
      case 'partielle':
        return <Badge color="orange" variant="filled" size="sm">Partielle</Badge>;
      case 'non_payee':
        return <Badge color="red" variant="filled" size="sm">Non payée</Badge>;
      default:
        return <Badge variant="light" size="sm">{statut}</Badge>;
    }
  };

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* EN-TÊTE */}
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
                  <IconCash size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Règlements de factures</Title>
                  <Text c="gray.3" size="sm">Suivez tous les paiements des clients</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button
                variant="light"
                color="white"
                leftSection={<IconRefresh size={18} />}
                onClick={chargerReglements}
              >
                Actualiser
              </Button>
              <Button
                variant="light"
                color="green"
                leftSection={<IconPlus size={18} />}
                onClick={() => setReglementModalOpened(true)}
              >
                Nouveau règlement
              </Button>
            </Group>
          </Flex>

          {/* Cartes statistiques */}
          <SimpleGrid cols={6} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Total</Text>
              <Text c="white" fw={700} size="xl">{filteredStats.total}</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Montant</Text>
              <Text c="white" fw={700} size="xl">{formatMontant(filteredStats.montant)} F</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(46,125,50,0.2)' }}>
              <Text c="white" size="xs">✅ Payées</Text>
              <Text c="white" fw={700} size="xl">{filteredStats.payees}</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(237,108,2,0.2)' }}>
              <Text c="white" size="xs">🟠 Partielles</Text>
              <Text c="white" fw={700} size="xl">{filteredStats.partielles}</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(211,47,47,0.2)' }}>
              <Text c="white" size="xs">🔴 Non payées</Text>
              <Text c="white" fw={700} size="xl">{filteredStats.nonPayees}</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Clients</Text>
              <Text c="white" fw={700} size="xl">{stats.totalClients}</Text>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* Filtres + Recherche sur une seule ligne */}
        <Card withBorder radius="lg" shadow="sm" p="xs">
          <Group align="flex-end" gap="xs" style={{ flexWrap: 'nowrap' }}>
            {/* Recherche */}
            <Box style={{ width: 140 }}>
              <TextInput
                placeholder="Rechercher..."
                leftSection={<IconSearch size={12} />}
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }}
                size="xs"
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>

            {/* Client */}
            <Box style={{ width: 130 }}>
              <Select
                placeholder="Client"
                data={clients}
                value={clientFiltre}
                onChange={setClientFiltre}
                size="xs"
                clearable
                searchable
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>

            {/* Statut paiement */}
            <Box style={{ width: 120 }}>
              <Select
                placeholder="Statut"
                value={statutFiltre}
                onChange={(value) => { setStatutFiltre(value); setCurrentPage(1); }}
                data={[
                  { value: 'payee', label: '✅ Payée' },
                  { value: 'partielle', label: '🟠 Partielle' },
                  { value: 'non_payee', label: '🔴 Non payée' }
                ]}
                size="xs"
                clearable
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>

            {/* Date début */}
            <Box style={{ width: 110 }}>
              <TextInput
                placeholder="Début"
                type="date"
                value={dateDebut}
                onChange={(e) => { setDateDebut(e.target.value); setCurrentPage(1); }}
                size="xs"
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>

            {/* Date fin */}
            <Box style={{ width: 110 }}>
              <TextInput
                placeholder="Fin"
                type="date"
                value={dateFin}
                onChange={(e) => { setDateFin(e.target.value); setCurrentPage(1); }}
                size="xs"
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>

            {/* BOUTONS D'ACTION */}
            <Group gap="xs" align="flex-end" style={{ paddingBottom: 2, flex: 1, justifyContent: 'flex-end' }}>
              <Button 
                variant="light" 
                color="teal" 
                onClick={handlePrintList} 
                size="xs"
                leftSection={<IconPrinter size={12} />}
                style={{ fontSize: '10px', padding: '4px 8px' }}
              >
                Imprimer
              </Button>
              <Button 
                variant="light" 
                color="red" 
                onClick={resetFilters} 
                size="xs" 
                leftSection={<IconX size={12} />}
                style={{ fontSize: '10px', padding: '4px 8px' }}
              >
                Effacer
              </Button>
              <Text size="xs" c="dimmed">
                {reglementsFiltres.length} règlement(s)
              </Text>
            </Group>
          </Group>
        </Card>

        {/* Zone imprimable */}
        <div ref={printRef}>
          {/* En-tête pour impression */}
          <div style={{ textAlign: 'center', marginBottom: 20, display: 'none' }}>
            <Title order={2}>Liste des règlements</Title>
            <Text>Date d'impression: {format(new Date(), 'dd/MM/yyyy à HH:mm')}</Text>
            <Text>Total: {reglementsFiltres.length} règlement(s) - Montant total: {formatMontant(filteredStats.montant)} FCFA</Text>
          </div>

          {/* Tableau des règlements */}
          <Card withBorder radius="lg" shadow="sm" p={0}>
            <Box style={{ overflowX: "auto" }}>
              <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                    <Table.Th c="white" w={50}>N°</Table.Th>
                    <Table.Th c="white">Date</Table.Th>
                    <Table.Th c="white">Client</Table.Th>
                    <Table.Th c="white" ta="right">Total</Table.Th>
                    <Table.Th c="white" ta="right">Versé</Table.Th>
                    <Table.Th c="white" ta="right">Cumul</Table.Th>
                    <Table.Th c="white" ta="right">Reste</Table.Th>
                    <Table.Th c="white" ta="center">Statut</Table.Th>
                    <Table.Th c="white" ta="center" className="no-print">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedData.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={9} align="center">
                        <Stack align="center" py={50}>
                          <IconCash size={50} color="#ccc" />
                          <Text c="dimmed">Aucun règlement trouvé</Text>
                          <Button variant="light" onClick={chargerReglements} size="xs">
                            Actualiser
                          </Button>
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    paginatedData.map((reg, idx) => {
                      const num = (currentPage - 1) * itemsPerPage + idx + 1;
                      
                      return (
                        <Table.Tr key={reg.idReglement}>
                          <Table.Td fw={500}>{num}</Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <IconCalendar size={12} color="#adb5bd" />
                              <Text size="sm">{formatDate(reg.date_reglement)}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="sm">
                              <Avatar size="sm" radius="xl" color="blue">
                                {(reg.client_nom || 'C').charAt(0).toUpperCase()}
                              </Avatar>
                              <div>
                                <Text fw={500} size="sm">{reg.client_nom || reg.client_societe || 'Client'}</Text>
                                <Text size="xs" c="dimmed">{reg.code_facture}</Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} size="sm">{formatMontant(reg.montant_total_facture)} F</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} size="sm" c="green">{formatMontant(reg.montant)} F</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} size="sm">{formatMontant(reg.cumul)} F</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} size="sm" c={reg.reste <= 0 ? 'green' : 'orange'}>
                              {formatMontant(reg.reste)} F
                            </Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            {getStatutBadge(reg.statut_paiement)}
                          </Table.Td>
                          <Table.Td ta="center" className="no-print">
                            <Group gap={4} justify="center">
                              <Tooltip label="Voir détails">
                                <ActionIcon
                                  size="md"
                                  color="blue"
                                  variant="light"
                                  onClick={() => handleViewDetails(reg)}
                                >
                                  <IconEye size={16} />
                                </ActionIcon>
                              </Tooltip>
                              
                              {reg.statut_paiement !== 'payee' && (
                                <Tooltip label={`Régler`}>
                                  <ActionIcon
                                    size="md"
                                    color="green"
                                    variant="light"
                                    onClick={() => handleOpenReglement(
                                      reg.idFacture,
                                      reg.idClient,
                                      reg.code_facture
                                    )}
                                  >
                                    <IconCash size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                              
                              <Tooltip label="Reçu">
                                <ActionIcon
                                  size="md"
                                  color="teal"
                                  variant="light"
                                  onClick={() => handlePrintReçu(reg)}
                                >
                                  <IconPrinter size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Box>

            {totalPages > 1 && (
              <Group justify="center" p="md" className="no-print">
                <Pagination
                  value={currentPage}
                  onChange={setCurrentPage}
                  total={totalPages}
                  size="md"
                />
              </Group>
            )}
          </Card>
        </div>

        {/* Modals... (inchangés) */}
        <Modal
          opened={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title="Détails du règlement"
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
                <div>
                  <Text size="xs" c="dimmed">Code règlement</Text>
                  <Text fw={600}>{selectedReglement.code_reglement}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Date</Text>
                  <Text>{formatDate(selectedReglement.date_reglement)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Client</Text>
                  <Text fw={500}>{selectedReglement.client_nom || selectedReglement.client_societe}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Facture</Text>
                  <Text>{selectedReglement.code_facture}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Mode</Text>
                  <Badge>{selectedReglement.mode_reglement}</Badge>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Montant</Text>
                  <Text fw={700} c="green">{formatMontant(selectedReglement.montant)} FCFA</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Statut</Text>
                  {getStatutBadge(selectedReglement.statut_paiement)}
                </div>
                <div>
                  <Text size="xs" c="dimmed">Reste</Text>
                  <Text fw={600} c={selectedReglement.reste <= 0 ? 'green' : 'orange'}>
                    {formatMontant(selectedReglement.reste)} FCFA
                  </Text>
                </div>
              </SimpleGrid>
              {selectedReglement.observation && (
                <>
                  <Divider />
                  <div>
                    <Text size="xs" c="dimmed">Observation</Text>
                    <Text size="sm">{selectedReglement.observation}</Text>
                  </div>
                </>
              )}
              <Divider />
              <Group justify="flex-end">
                <Button variant="outline" onClick={() => setDetailsModalOpen(false)}>
                  Fermer
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        <FormulaireReglement
          opened={reglementModalOpened}
          onClose={() => {
            setReglementModalOpened(false);
            setSelectedFactureId(null);
            setSelectedClientId(null);
            chargerReglements();
          }}
          idFacture={selectedFactureId || undefined}
          idClient={selectedClientId || undefined}
          montantMax={selectedMontantMax}
        />

        <Modal
          opened={reçuModalOpened}
          onClose={() => setReçuModalOpened(false)}
          size="lg"
          centered
          styles={{
            header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
            title: { color: 'white', fontWeight: 600 },
            body: { padding: 0 }
          }}
          title={
            <Group gap="xs">
              <IconCash size={20} color="white" />
              <Text fw={600} c="white">Reçu de règlement</Text>
            </Group>
          }
        >
          {selectedReglementForReçu && (
            <ReçuReglement 
              reglement={selectedReglementForReçu} 
              onClose={() => setReçuModalOpened(false)}
            />
          )}
        </Modal>
      </Stack>
    </Box>
  );
};

export default ListeReglements;