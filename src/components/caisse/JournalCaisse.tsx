// src/components/caisse/JournalCaisse.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table, 
  Pagination, Modal, Divider, ThemeIcon,
  SimpleGrid, Select, TextInput, Badge, Flex, Paper,
  Loader, Center, NumberInput, ScrollArea, Tabs, 
  Alert, Grid, Textarea
} from '@mantine/core';
import {
  IconCash, IconSearch, IconRefresh, IconPrinter,
  IconPlus, IconCalendar, IconMoneybag,
  
  IconArrowUpRight, IconArrowDownRight,
  IconFileText, IconAlertCircle
  } from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface JournalEntry {
  idJournal: number;
  code_journal: string;
  date_journal: string;
  type_mouvement: 'ENTREE' | 'SORTIE';
  categorie: 'VENTE_COMPTOIR' | 'REGLEMENT_FACTURE' | 'DECOMPTE_REVENDEUR' | 'CHARGE_FONCTIONNEMENT' | 'AUTRE_ENTREE' | 'AUTRE_SORTIE';
  designation: string;
  montant: number;
  solde_apres: number;
  reference: string;
  idReference: number;
  notes: string;
  created_at: string;
}

interface ChargeFonctionnement {
  idCharge: number;
  code_charge: string;
  date_charge: string;
  designation: string;
  montant: number;
  beneficiaire: string;
  categorie_charge: 'EAU' | 'ELECTRICITE' | 'LOYER' | 'SALAIRE' | 'TRANSPORT' | 'COMMUNICATION' | 'AUTRE';
  reference_paiement: string;
  idJournal: number;
  notes: string;
  created_at: string;
}

interface RecapJournalier {
  date_recap: string;
  solde_initial: number;
  total_entrees: number;
  total_sorties: number;
  solde_final: number;
  total_ventes_comptoir: number;
  total_reglements_factures: number;
  total_decomptes_revendeurs: number;
  total_charges: number;
}

const categoriesCharges = [
  { value: 'EAU', label: '💧 Eau' },
  { value: 'ELECTRICITE', label: '⚡ Électricité' },
  { value: 'LOYER', label: '🏠 Loyer' },
  { value: 'SALAIRE', label: '👤 Salaire' },
  { value: 'TRANSPORT', label: '🚗 Transport' },
  { value: 'COMMUNICATION', label: '📱 Communication' },
  { value: 'AUTRE', label: '📌 Autres charges' }
];

const categorieLabels: Record<string, string> = {
  'VENTE_COMPTOIR': 'Vente comptoir',
  'REGLEMENT_FACTURE': 'Règlement facture',
  'DECOMPTE_REVENDEUR': 'Décompte revendeur',
  'CHARGE_FONCTIONNEMENT': 'Charge fonctionnement',
  'AUTRE_ENTREE': 'Autre entrée',
  'AUTRE_SORTIE': 'Autre sortie'
};

const categorieColors: Record<string, string> = {
  'VENTE_COMPTOIR': 'teal',
  'REGLEMENT_FACTURE': 'green',
  'DECOMPTE_REVENDEUR': 'orange',
  'CHARGE_FONCTIONNEMENT': 'red',
  'AUTRE_ENTREE': 'blue',
  'AUTRE_SORTIE': 'gray'
};

export const JournalCaisse: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [charges, setCharges] = useState<ChargeFonctionnement[]>([]);
  const [recap, setRecap] = useState<RecapJournalier | null>(null);
  const [soldeActuel, setSoldeActuel] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<string | null>('journal');
  const [currentPage, setCurrentPage] = useState(1);
  const [chargeModalOpened, setChargeModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Formulaire charge
  const [chargeForm, setChargeForm] = useState({
    designation: '',
    montant: 0,
    beneficiaire: '',
    categorie_charge: 'AUTRE',
    reference_paiement: '',
    notes: ''
  });

  const itemsPerPage = 15;

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      
      // Récupérer le solde actuel
      const soldeResult = await db.select<{ solde: number }[]>(`
        SELECT solde_apres as solde 
        FROM journal_caisse 
        ORDER BY idJournal DESC 
        LIMIT 1
      `);
      setSoldeActuel(soldeResult[0]?.solde || 0);
      
      // Récupérer le journal du jour
      const entries = await db.select<JournalEntry[]>(`
        SELECT * FROM journal_caisse 
        WHERE date(date_journal) = date(?)
        ORDER BY idJournal ASC
      `, [selectedDate]);
      setJournalEntries(entries || []);
      
      // Récupérer les charges du jour
      const chargesData = await db.select<ChargeFonctionnement[]>(`
        SELECT * FROM charges_fonctionnement 
        WHERE date(date_charge) = date(?)
        ORDER BY date_charge DESC
      `, [selectedDate]);
      setCharges(chargesData || []);
      
      // Récupérer ou générer le récapitulatif
      const recapResult = await db.select<RecapJournalier[]>(`
        SELECT * FROM recapitulatif_journalier 
        WHERE date_recap = date(?)
      `, [selectedDate]);
      
      if (recapResult.length > 0) {
        // Utiliser le récapitulatif existant
        setRecap(recapResult[0]);
      } else {
        // Calculer le récapitulatif
        const initial = await db.select<{ solde: number }[]>(`
          SELECT solde_apres as solde 
          FROM journal_caisse 
          WHERE date(date_journal) < date(?)
          ORDER BY idJournal DESC 
          LIMIT 1
        `, [selectedDate]);
        
        const initSolde = initial[0]?.solde || 0;
        
        const mouvements = await db.select<any[]>(`
          SELECT type_mouvement, categorie, SUM(montant) as total
          FROM journal_caisse
          WHERE date(date_journal) = date(?)
          GROUP BY type_mouvement, categorie
        `, [selectedDate]);
        
        let totalEntrees = 0, totalSorties = 0;
        let totalVentesComptoir = 0, totalReglementsFactures = 0;
        let totalDecomptesRevendeurs = 0, totalCharges = 0;
        
        for (const m of mouvements) {
          if (m.type_mouvement === 'ENTREE') {
            totalEntrees += m.total;
            if (m.categorie === 'VENTE_COMPTOIR') totalVentesComptoir += m.total;
            if (m.categorie === 'REGLEMENT_FACTURE') totalReglementsFactures += m.total;
            if (m.categorie === 'DECOMPTE_REVENDEUR') totalDecomptesRevendeurs += m.total;
          } else if (m.type_mouvement === 'SORTIE') {
            totalSorties += m.total;
            if (m.categorie === 'CHARGE_FONCTIONNEMENT') totalCharges += m.total;
          }
        }
        
        const soldeFinal = initSolde + totalEntrees - totalSorties;
        
        const newRecap = {
          date_recap: selectedDate,
          solde_initial: initSolde,
          total_entrees: totalEntrees,
          total_sorties: totalSorties,
          solde_final: soldeFinal,
          total_ventes_comptoir: totalVentesComptoir,
          total_reglements_factures: totalReglementsFactures,
          total_decomptes_revendeurs: totalDecomptesRevendeurs,
          total_charges: totalCharges
        };
        
        // Utiliser INSERT OR REPLACE pour éviter l'erreur UNIQUE
        await db.execute(`
          INSERT OR REPLACE INTO recapitulatif_journalier (
            date_recap, solde_initial, total_entrees, total_sorties, solde_final,
            total_ventes_comptoir, total_reglements_factures, total_decomptes_revendeurs, total_charges
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          selectedDate, initSolde, totalEntrees, totalSorties, soldeFinal,
          totalVentesComptoir, totalReglementsFactures, totalDecomptesRevendeurs, totalCharges
        ]);
        
        setRecap(newRecap);
      }
      
    } catch (error) {
      console.error('Erreur chargement:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les données',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, [selectedDate]);

  const handleAjouterCharge = async () => {
    if (!chargeForm.designation || chargeForm.montant <= 0 || !chargeForm.beneficiaire) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez remplir tous les champs obligatoires',
        color: 'red'
      });
      return;
    }

    setSaving(true);
    const db = await getDb();
    
    try {
      // Générer le code charge
      const chargeCount = await db.select<{ count: number }[]>(`
        SELECT COUNT(*) as count FROM charges_fonctionnement
      `);
      const codeCharge = `CHG-${String((chargeCount[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      // Calculer le nouveau solde
      const soldeActuel = await db.select<{ solde: number }[]>(`
        SELECT solde_apres as solde 
        FROM journal_caisse 
        ORDER BY idJournal DESC 
        LIMIT 1
      `);
      const currentSolde = soldeActuel[0]?.solde || 0;
      
      if (chargeForm.montant > currentSolde) {
        notifications.show({
          title: 'Erreur',
          message: `Solde insuffisant. Solde actuel: ${currentSolde.toLocaleString()} FCFA`,
          color: 'red'
        });
        setSaving(false);
        return;
      }
      
      const nouveauSolde = currentSolde - chargeForm.montant;
      
      // Générer le code journal
      const journalCount = await db.select<{ count: number }[]>(`
        SELECT COUNT(*) as count FROM journal_caisse
      `);
      const codeJournal = `JRN-${String((journalCount[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      // Insérer dans le journal de caisse
      const journalResult = await db.execute(`
        INSERT INTO journal_caisse (
          code_journal, date_journal, type_mouvement, categorie,
          designation, montant, solde_apres, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        codeJournal,
        new Date().toISOString(),
        'SORTIE',
        'CHARGE_FONCTIONNEMENT',
        chargeForm.designation,
        chargeForm.montant,
        nouveauSolde,
        chargeForm.notes || null
      ]);
      
      const idJournal = Number(journalResult.lastInsertId);
      
      // Insérer la charge
      await db.execute(`
        INSERT INTO charges_fonctionnement (
          code_charge, date_charge, designation, montant,
          beneficiaire, categorie_charge, reference_paiement,
          idJournal, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        codeCharge,
        new Date().toISOString(),
        chargeForm.designation,
        chargeForm.montant,
        chargeForm.beneficiaire,
        chargeForm.categorie_charge,
        chargeForm.reference_paiement || null,
        idJournal,
        chargeForm.notes || null
      ]);

      notifications.show({
        title: '✅ Succès',
        message: `Charge "${chargeForm.designation}" ajoutée avec succès`,
        color: 'green'
      });

      setChargeModalOpened(false);
      setChargeForm({
        designation: '',
        montant: 0,
        beneficiaire: '',
        categorie_charge: 'AUTRE',
        reference_paiement: '',
        notes: ''
      });
      chargerDonnees();
    } catch (error: any) {
      notifications.show({
        title: '❌ Erreur',
        message: error.message || 'Erreur lors de l\'ajout',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const formatDate = (dateStr: string): string => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: fr });
    } catch {
      return '-';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'ENTREE' ? 
      <IconArrowUpRight size={16} color="#2e7d32" /> : 
      <IconArrowDownRight size={16} color="#c62828" />;
  };

  const getCategorieBadge = (categorie: string) => {
    return (
      <Badge color={categorieColors[categorie] || 'gray'} variant="light" size="sm">
        {categorieLabels[categorie] || categorie}
      </Badge>
    );
  };

  const filteredEntries = journalEntries.filter(entry =>
    entry.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entry.reference && entry.reference.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const filteredCharges = charges.filter(charge =>
    charge.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    charge.beneficiaire.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* EN-TÊTE */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconCash size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Journal de Caisse</Title>
              <Text c="gray.3" size="sm">Suivi des entrées et sorties d'argent</Text>
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
          </Group>
        </Flex>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconMoneybag size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Solde actuel</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(soldeActuel)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(46,125,50,0.3)' }}>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconArrowUpRight size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Entrées</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(recap?.total_entrees || 0)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(211,47,47,0.3)' }}>
            <Group>
              <ThemeIcon color="red" variant="light" size="lg">
                <IconArrowDownRight size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Sorties</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(recap?.total_sorties || 0)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconCalendar size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Date</Text>
                <Text c="white" fw={700} size="xl">
                  {format(new Date(selectedDate), 'dd/MM/yyyy', { locale: fr })}
                </Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* FILTRES ET ACTIONS */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Grid align="flex-end">
          <Grid.Col span={4}>
            <TextInput
              label="Date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              size="md"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              placeholder="Rechercher par désignation ou référence..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="md"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Group justify="flex-end">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconRefresh size={16} />}
                onClick={() => chargerDonnees()}
              >
                Charger
              </Button>
              <Button
                variant="filled"
                color="red"
                leftSection={<IconPlus size={16} />}
                onClick={() => setChargeModalOpened(true)}
              >
                Charge
              </Button>
              <Button
                variant="light"
                color="teal"
                leftSection={<IconPrinter size={16} />}
                onClick={() => {
                  notifications.show({
                    title: 'Information',
                    message: 'Impression en cours de développement',
                    color: 'blue'
                  });
                }}
              >
                Imprimer
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>

      {/* TABS */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow>
            <Tabs.Tab value="journal" leftSection={<IconFileText size={16} />}>
              Journal de caisse
              <Badge size="xs" color="blue" ml="xs" variant="light">{journalEntries.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="charges" leftSection={<IconMoneybag size={16} />}>
              Charges fonctionnement
              <Badge size="xs" color="red" ml="xs" variant="light">{charges.length}</Badge>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="journal" pt="md">
            <Card withBorder radius="lg" shadow="sm" p={0}>
              <ScrollArea h={450}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                      <Table.Th c="white" w={50}>N°</Table.Th>
                      <Table.Th c="white">Date</Table.Th>
                      <Table.Th c="white">Désignation</Table.Th>
                      <Table.Th c="white" ta="center">Type</Table.Th>
                      <Table.Th c="white" ta="right">Montant</Table.Th>
                      <Table.Th c="white" ta="right">Solde</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedEntries.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6} align="center">
                          <Text c="dimmed" py={40}>Aucun mouvement pour cette date</Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      paginatedEntries.map((entry, idx) => {
                        const num = (currentPage - 1) * itemsPerPage + idx + 1;
                        return (
                          <Table.Tr key={entry.idJournal}>
                            <Table.Td fw={600}>{num}</Table.Td>
                            <Table.Td>
                              <Text size="sm">{formatDate(entry.date_journal)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                {getCategorieBadge(entry.categorie)}
                                <Text size="sm" fw={500}>{entry.designation}</Text>
                              </Group>
                              {entry.reference && (
                                <Text size="xs" c="dimmed">Réf: {entry.reference}</Text>
                              )}
                            </Table.Td>
                            <Table.Td ta="center">
                              {getTypeIcon(entry.type_mouvement)}
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={600} c={entry.type_mouvement === 'ENTREE' ? 'green' : 'red'}>
                                {entry.type_mouvement === 'ENTREE' ? '+' : '-'}
                                {formatMontant(entry.montant)} F
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={700}>{formatMontant(entry.solde_apres)} F</Text>
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
          </Tabs.Panel>

          <Tabs.Panel value="charges" pt="md">
            <Card withBorder radius="lg" shadow="sm" p={0}>
              <ScrollArea h={450}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                      <Table.Th c="white" w={50}>N°</Table.Th>
                      <Table.Th c="white">Date</Table.Th>
                      <Table.Th c="white">Désignation</Table.Th>
                      <Table.Th c="white">Bénéficiaire</Table.Th>
                      <Table.Th c="white">Catégorie</Table.Th>
                      <Table.Th c="white" ta="right">Montant</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredCharges.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6} align="center">
                          <Text c="dimmed" py={40}>Aucune charge pour cette date</Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredCharges.map((charge, idx) => (
                        <Table.Tr key={charge.idCharge}>
                          <Table.Td fw={600}>{idx + 1}</Table.Td>
                          <Table.Td>{formatDate(charge.date_charge)}</Table.Td>
                          <Table.Td>
                            <Text fw={500} size="sm">{charge.designation}</Text>
                            {charge.reference_paiement && (
                              <Text size="xs" c="dimmed">Réf: {charge.reference_paiement}</Text>
                            )}
                          </Table.Td>
                          <Table.Td>{charge.beneficiaire}</Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="sm">
                              {categoriesCharges.find(c => c.value === charge.categorie_charge)?.label || charge.categorie_charge}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c="red">{formatMontant(charge.montant)} F</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* MODAL AJOUT CHARGE */}
      <Modal
        opened={chargeModalOpened}
        onClose={() => setChargeModalOpened(false)}
        title="Ajouter une charge de fonctionnement"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
            Solde actuel: <strong>{formatMontant(soldeActuel)} FCFA</strong>
          </Alert>

          <TextInput
            label="Désignation *"
            placeholder="Ex: Achat fournitures bureau"
            value={chargeForm.designation}
            onChange={(e) => setChargeForm({ ...chargeForm, designation: e.target.value })}
            required
          />

          <NumberInput
            label="Montant *"
            placeholder="0"
            value={chargeForm.montant}
            onChange={(val) => setChargeForm({ ...chargeForm, montant: typeof val === 'number' ? val : 0 })}
            min={0}
            step={100}
            required
            leftSection="FCFA"
          />

          <TextInput
            label="Bénéficiaire *"
            placeholder="Nom du bénéficiaire"
            value={chargeForm.beneficiaire}
            onChange={(e) => setChargeForm({ ...chargeForm, beneficiaire: e.target.value })}
            required
          />

          <Select
            label="Catégorie"
            placeholder="Sélectionner une catégorie"
            data={categoriesCharges}
            value={chargeForm.categorie_charge}
            onChange={(value) => setChargeForm({ ...chargeForm, categorie_charge: value || 'AUTRE' })}
          />

          <TextInput
            label="Référence de paiement"
            placeholder="N° de chèque, virement, etc."
            value={chargeForm.reference_paiement}
            onChange={(e) => setChargeForm({ ...chargeForm, reference_paiement: e.target.value })}
          />

          <Textarea
            label="Notes"
            placeholder="Informations complémentaires"
            value={chargeForm.notes}
            onChange={(e) => setChargeForm({ ...chargeForm, notes: e.target.value })}
            rows={3}
          />

          <Divider />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setChargeModalOpened(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAjouterCharge}
              loading={saving}
              color="red"
              leftSection={<IconPlus size={16} />}
            >
              Ajouter la charge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default JournalCaisse;