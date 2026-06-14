// src/components/reglements/ListeReglements.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table, ActionIcon,
  Box, Pagination, Tooltip, Modal, Divider, ThemeIcon,
  SimpleGrid, Select, TextInput, Avatar, Badge, Flex, Paper, 
  Loader, Center
} from '@mantine/core';
import {
  IconBuildingStore, IconSearch, IconRefresh,
  IconCalendar, IconCash, IconPrinter, IconEye,
  IconReceipt, IconDownload, IconPlus} from '@tabler/icons-react';
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
}

const ListeReglements: React.FC = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const [reglements, setReglements] = useState<ReglementWithCumul[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [clientFiltre, setClientFiltre] = useState<string | null>(null);
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
  const [stats, setStats] = useState({
    totalReglements: 0,
    totalMontant: 0,
    totalClients: 0
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
        
        return {
          ...reg,
          cumul,
          reste,
          montant_total_facture: totalFacture
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
      
      setStats({
        totalReglements: reglementsWithCumul.length,
        totalMontant,
        totalClients
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

  // Impression de la liste
  const handlePrintList = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Liste_Reglements_${format(new Date(), 'dd-MM-yyyy')}`,
    onAfterPrint: () => {
      notifications.show({
        title: 'Impression',
        message: 'Impression de la liste lancée',
        color: 'blue',
      });
    },
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

  const handleExport = (reglement: ReglementWithCumul) => {
    notifications.show({
      title: 'Export',
      message: `Export du règlement ${reglement.code_reglement}`,
      color: 'blue',
    });
  };

  const handleOpenReglement = async (factureId: number, clientId: number, factureCode: string, _p0?: string) => {
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

  const isFactureReglee = (reste: number) => {
    return reste <= 0;
  };

  const reglementsFiltres = reglements.filter(r => {
    const matchRecherche = recherche === "" ||
      r.code_reglement?.toLowerCase().includes(recherche.toLowerCase()) ||
      r.client_nom?.toLowerCase().includes(recherche.toLowerCase()) ||
      r.code_facture?.toLowerCase().includes(recherche.toLowerCase());
    
    const matchClient = clientFiltre ? r.idClient?.toString() === clientFiltre : true;
    
    return matchRecherche && matchClient;
  });

  const totalPages = Math.ceil(reglementsFiltres.length / itemsPerPage);
  const paginatedData = reglementsFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
          <SimpleGrid cols={3} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconReceipt size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Total règlements</Text>
                  <Text c="white" fw={700} size="xl">{stats.totalReglements}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconCash size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Montant total</Text>
                  <Text c="white" fw={700} size="xl">{formatMontant(stats.totalMontant)} FCFA</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Clients distincts</Text>
                  <Text c="white" fw={700} size="xl">{stats.totalClients}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* Barre d'outils */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Flex justify="space-between" align="flex-end" wrap="wrap" gap="md">
            <Group grow>
              <TextInput
                placeholder="Rechercher par code, client, facture..."
                leftSection={<IconSearch size={16} />}
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }}
                size="md"
                style={{ width: 300 }}
              />
              <Select
                placeholder="Filtrer par client"
                data={clients}
                value={clientFiltre}
                onChange={setClientFiltre}
                size="md"
                style={{ width: 250 }}
                clearable
                searchable
              />
            </Group>
            <Tooltip label="Imprimer la liste">
              <Button
                variant="light"
                color="teal"
                leftSection={<IconPrinter size={16} />}
                onClick={handlePrintList}
              >
                Imprimer liste
              </Button>
            </Tooltip>
          </Flex>
        </Card>

        {/* Zone imprimable */}
        <div ref={printRef}>
          {/* En-tête pour impression */}
          <div style={{ textAlign: 'center', marginBottom: 20, display: 'none' }}>
            <Title order={2}>Liste des règlements</Title>
            <Text>Date d'impression: {format(new Date(), 'dd/MM/yyyy à HH:mm')}</Text>
            <Text>Total: {reglementsFiltres.length} règlement(s) - Montant total: {formatMontant(stats.totalMontant)} FCFA</Text>
          </div>

          {/* Tableau des règlements */}
          <Card withBorder radius="lg" shadow="sm" p={0}>
            <Box style={{ overflowX: "auto" }}>
              <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                    <Table.Th c="white" w={60}>N°</Table.Th>
                    <Table.Th c="white">Date</Table.Th>
                    <Table.Th c="white">Nom du client</Table.Th>
                    <Table.Th c="white" ta="right">Montant HT</Table.Th>
                    <Table.Th c="white" ta="right">Montant versé</Table.Th>
                    <Table.Th c="white" ta="right">Cumul</Table.Th>
                    <Table.Th c="white" ta="right">Reste à payer</Table.Th>
                    <Table.Th c="white" ta="center" className="no-print">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedData.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={8} align="center">
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
                      const estReglee = isFactureReglee(reg.reste);
                      
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
                                <Text fw={500} size="sm">{reg.client_nom || reg.client_societe || 'Client inconnu'}</Text>
                                <Text size="xs" c="dimmed">{reg.code_facture}</Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} size="sm">{formatMontant(reg.montant_total_facture)} FCFA</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} size="sm" c="green">{formatMontant(reg.montant)} FCFA</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} size="sm">{formatMontant(reg.cumul)} FCFA</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Badge color={reg.reste <= 0 ? 'green' : 'orange'} variant="light" size="sm">
                              {reg.reste <= 0 ? 'Soldé' : `${formatMontant(reg.reste)} FCFA`}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="center" className="no-print">
                            <Group gap={6} justify="center">
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
                              
                              {!estReglee && (
                                <Tooltip label={`Régler le solde (${formatMontant(reg.reste)} FCFA)`}>
                                  <ActionIcon
                                    size="md"
                                    color="green"
                                    variant="light"
                                    onClick={() => handleOpenReglement(
                                      reg.idFacture,
                                      reg.idClient,
                                      reg.code_facture,
                                      reg.client_nom || reg.client_societe
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
                              <Tooltip label="Exporter">
                                <ActionIcon
                                  size="md"
                                  color="grape"
                                  variant="light"
                                  onClick={() => handleExport(reg)}
                                >
                                  <IconDownload size={16} />
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
                  <Text size="xs" c="dimmed">Mode de règlement</Text>
                  <Badge>{selectedReglement.mode_reglement}</Badge>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Référence</Text>
                  <Text>{selectedReglement.reference || '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Montant versé</Text>
                  <Text fw={700} c="green">{formatMontant(selectedReglement.montant)} FCFA</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Montant total facture</Text>
                  <Text>{formatMontant(selectedReglement.montant_total_facture)} FCFA</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Cumul versé</Text>
                  <Text fw={600}>{formatMontant(selectedReglement.cumul)} FCFA</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Reste à payer</Text>
                  <Badge color={selectedReglement.reste <= 0 ? 'green' : 'orange'}>
                    {selectedReglement.reste <= 0 ? 'Soldé' : `${Math.abs(selectedReglement.reste).toLocaleString()} FCFA`}
                  </Badge>
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