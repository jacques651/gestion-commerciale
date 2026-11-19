// src/components/caisse/ChargesFonctionnement.tsx
import React, { useState, useEffect } from 'react';
import { confirm } from '../../utils/confirm';
import {
  Stack, Card, Title, Text, Group, Button, Table, ActionIcon,
  Pagination, Tooltip, Modal, Divider, ThemeIcon,
  SimpleGrid, Select, TextInput, Badge, Flex, Paper,
  Loader, Center, NumberInput, ScrollArea, Textarea, Alert,
  Grid
} from '@mantine/core';
import {
  IconMoneybag, IconSearch, IconRefresh, IconPlus,
  IconX, IconCalendar, IconEdit, IconTrash,
  IconAlertCircle, IconEye, 
  IconUser, IconCash, IconList
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { useAuth } from '../../contexts/AuthContext';
import { notifications } from '@mantine/notifications';
import { journalCaisseService } from '../../services/journalCaisseService';
import TkFilters from '../TkFilters';

interface ChargeFonctionnement {
  idCharge: number;
  code_charge: string;
  date_charge: string;
  designation: string;
  montant: number;
  beneficiaire: string;
  categorie_charge: string;
  reference_paiement: string;
  idJournal: number;
  notes: string;
  created_at: string;
}

interface RecapCharge {
  total_charges: number;
  total_charges_mois: number;
  total_charges_jour: number;
  par_categorie: Record<string, number>;
}

const categoriesCharges = [
  { value: 'EAU', label: 'Eau', icon: '💧', color: 'blue' },
  { value: 'ELECTRICITE', label: 'Électricité', icon: '⚡', color: 'yellow' },
  { value: 'LOYER', label: 'Loyer', icon: '🏠', color: 'green' },
  { value: 'SALAIRE', label: 'Salaire', icon: '👤', color: 'grape' },
  { value: 'TRANSPORT', label: 'Transport', icon: '🚗', color: 'orange' },
  { value: 'COMMUNICATION', label: 'Communication', icon: '📱', color: 'cyan' },
  { value: 'AUTRE', label: 'Autres charges', icon: '📌', color: 'gray' }
];

const getCategorieInfo = (code: string) => {
  return categoriesCharges.find(c => c.value === code)
    || { value: code, label: code || 'Autre', icon: '📌', color: 'gray' };
};

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

export const ChargesFonctionnement: React.FC = () => {
  const { user } = useAuth();
  const [charges, setCharges] = useState<ChargeFonctionnement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategorie, setSelectedCategorie] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpened, setModalOpened] = useState(false);
  const [detailsModalOpened, setDetailsModalOpened] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<ChargeFonctionnement | null>(null);
  const [recap, setRecap] = useState<RecapCharge | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ChargeFonctionnement | null>(null);
  const [soldeActuel, setSoldeActuel] = useState(0);
  const [categoriesList, setCategoriesList] = useState(categoriesCharges);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const [formData, setFormData] = useState({
    designation: '',
    montant: 0,
    beneficiaire: '',
    categorie_charge: 'AUTRE',
    reference_paiement: '',
    notes: ''
  });

  const itemsPerPage = 10;

  const chargerSolde = async () => {
    try {
      const solde = await journalCaisseService.getSoldeActuel();
      setSoldeActuel(solde);
    } catch (error) {
      console.error('Erreur chargement solde:', error);
    }
  };

  const chargerCharges = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      
      let query = `
        SELECT * FROM charges_fonctionnement 
        WHERE 1=1
      `;
      const params: any[] = [];

      if (searchTerm) {
        query += ` AND (designation LIKE ? OR beneficiaire LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      if (selectedCategorie) {
        query += ` AND categorie_charge = ?`;
        params.push(selectedCategorie);
      }

      if (dateDebut) {
        query += ` AND date(date_charge) >= date(?)`;
        params.push(dateDebut);
      }

      if (dateFin) {
        query += ` AND date(date_charge) <= date(?)`;
        params.push(dateFin);
      }

      query += ` ORDER BY date_charge DESC, idCharge DESC`;

      const result = await db.select<ChargeFonctionnement[]>(query, params);
      setCharges(result || []);

      // Calculer les récapitulatifs
      const actives = result.filter(c => !(c as any).est_annule);
      const totalCharges = actives.reduce((sum, c) => sum + c.montant, 0);
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = today.substring(0, 7);
      
      const chargesJour = actives.filter(c => c.date_charge.startsWith(today));
      const chargesMois = actives.filter(c => c.date_charge.startsWith(currentMonth));
      
      const parCategorie: Record<string, number> = {};
      for (const c of categoriesCharges) {
        const total = actives.filter(r => r.categorie_charge === c.value).reduce((sum, r) => sum + r.montant, 0);
        if (total > 0) {
          parCategorie[c.value] = total;
        }
      }

      setRecap({
        total_charges: totalCharges,
        total_charges_mois: chargesMois.reduce((sum, c) => sum + c.montant, 0),
        total_charges_jour: chargesJour.reduce((sum, c) => sum + c.montant, 0),
        par_categorie: parCategorie
      });

      // Charger le solde
      await chargerSolde();

    } catch (error) {
      console.error('Erreur chargement charges:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les charges',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategoriesCharges = async () => {
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(
        'SELECT code_categorie, libelle FROM categories_charges WHERE est_actif = 1 ORDER BY libelle'
      );
      const merged = [...categoriesCharges];
      for (const r of rows) {
        if (!merged.find(c => c.value === r.code_categorie)) {
          merged.push({ value: r.code_categorie, label: r.libelle, icon: '📌', color: 'gray' });
        }
      }
      setCategoriesList(merged);
    } catch (e) {
      console.error('Erreur chargement catégories de charge:', e);
    }
  };

  const handleAddCategorie = async () => {
    const libelle = newCatLabel.trim();
    if (!libelle) {
      notifications.show({ title: 'Erreur', message: 'Le nom de la catégorie est requis', color: 'red' });
      return;
    }
    setAddingCat(true);
    try {
      const db = await getDb();
      // Générer un code à partir du libellé (sans accents, MAJUSCULES)
      const code = libelle.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'CAT_' + Date.now();
      await db.execute(
        'INSERT OR IGNORE INTO categories_charges (code_categorie, libelle) VALUES (?, ?)',
        [code, libelle]
      );
      await loadCategoriesCharges();
      setFormData(prev => ({ ...prev, categorie_charge: code }));
      setNewCatModalOpen(false);
      setNewCatLabel('');
      notifications.show({ title: 'Succès', message: `Catégorie « ${libelle} » ajoutée`, color: 'green' });
    } catch (e) {
      notifications.show({ title: 'Erreur', message: "Impossible d'ajouter la catégorie", color: 'red' });
    } finally {
      setAddingCat(false);
    }
  };

  useEffect(() => {
    chargerCharges();
    loadCategoriesCharges();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      chargerCharges();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategorie, dateDebut, dateFin]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategorie(null);
    setDateDebut('');
    setDateFin('');
    setCurrentPage(1);
  };

  const handleSubmit = async () => {
    if (!formData.designation.trim() || !formData.beneficiaire.trim() || formData.montant <= 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez remplir tous les champs obligatoires',
        color: 'red'
      });
      return;
    }

    setSaving(true);
    try {
      const db = await getDb();

      // Une charge de fonctionnement est une dépense réelle : elle doit
      // toujours pouvoir être enregistrée, même si le solde est bas ou nul.
      if (editing) {
        await db.execute(`
          UPDATE charges_fonctionnement
          SET designation = ?, montant = ?, beneficiaire = ?, categorie_charge = ?, reference_paiement = ?, notes = ?
          WHERE idCharge = ?
        `, [
          formData.designation.trim(),
          formData.montant,
          formData.beneficiaire.trim(),
          formData.categorie_charge,
          formData.reference_paiement.trim(),
          formData.notes.trim(),
          editing.idCharge
        ]);

        // Répercuter la modification sur l'écriture de caisse liée (montant/libellé)
        // puis recalculer les soldes, pour que la caisse reste cohérente.
        if ((editing as any).idJournal) {
          await db.execute(
            `UPDATE journal_caisse SET designation = ?, montant = ? WHERE idJournal = ?`,
            [formData.designation.trim(), formData.montant, (editing as any).idJournal]
          );
          try { await journalCaisseService.recomputeSoldeApres(); } catch {}
        }

        notifications.show({
          title: '✅ Succès',
          message: 'Charge modifiée avec succès',
          color: 'green'
        });
      } else {
        const result = await journalCaisseService.ajouterCharge({
          designation: formData.designation.trim(),
          montant: formData.montant,
          beneficiaire: formData.beneficiaire.trim(),
          categorie_charge: formData.categorie_charge,
          reference_paiement: formData.reference_paiement.trim(),
          notes: formData.notes.trim()
        });

        console.log('✅ Charge ajoutée avec succès, ID Journal:', result.idJournal);

        notifications.show({
          title: '✅ Succès',
          message: `Charge "${formData.designation}" ajoutée avec succès - ${formData.montant.toLocaleString()} FCFA`,
          color: 'green'
        });
      }

      setModalOpened(false);
      setEditing(null);
      setFormData({
        designation: '',
        montant: 0,
        beneficiaire: '',
        categorie_charge: 'AUTRE',
        reference_paiement: '',
        notes: ''
      });

      await chargerCharges();
    } catch (error: any) {
      console.error('Erreur sauvegarde charge:', error);
      notifications.show({
        title: '❌ Erreur',
        message: error?.message || 'Impossible de sauvegarder la charge',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (charge: ChargeFonctionnement) => {
    setEditing(charge);
    setFormData({
      designation: charge.designation,
      montant: charge.montant,
      beneficiaire: charge.beneficiaire,
      categorie_charge: charge.categorie_charge,
      reference_paiement: charge.reference_paiement || '',
      notes: charge.notes || ''
    });
    setModalOpened(true);
  };

  const handleDelete = async (idCharge: number) => {
    if (!await confirm('Annuler cette charge ? Son impact sur la caisse sera neutralisé et la charge restera visible, marquée « Annulé ».', 'Annulation')) return;

    try {
      const db = await getDb();

      const rows = await db.select<any[]>(`
        SELECT idJournal, designation, montant, COALESCE(est_annule, 0) AS est_annule
        FROM charges_fonctionnement WHERE idCharge = ?
      `, [idCharge]);
      const charge = rows[0];
      if (!charge) return;
      if (charge.est_annule) {
        notifications.show({ title: 'Info', message: 'Charge déjà annulée', color: 'blue' });
        return;
      }

      // Neutraliser l'impact caisse SANS supprimer l'écriture d'origine (la
      // suppression violerait la clé étrangère de charges_fonctionnement).
      // On poste une ENTREE de contrepassation du même montant : l'entrée annule
      // la sortie, le solde revient à sa valeur correcte, la piste d'audit reste
      // complète (sortie + entrée toutes deux visibles).
      try {
        await journalCaisseService.ajouterEntree({
          categorie: 'AUTRE_ENTREE',
          designation: `Annulation charge — ${charge.designation || ''}`.trim(),
          montant: Number(charge.montant) || 0,
          notes: `CONTREPASSATION CHARGE #${idCharge}`,
        });
      } catch (e) {
        console.error('Contrepassation charge:', e);
      }

      // Marquer la charge annulée (conservée et tracée, exclue des totaux).
      await db.execute(
        `UPDATE charges_fonctionnement
         SET est_annule = 1, date_annulation = datetime('now'), annule_par = ?
         WHERE idCharge = ?`,
        [user?.nom || null, idCharge]
      );

      notifications.show({
        title: '✅ Charge annulée',
        message: `Charge "${charge[0]?.designation || ''}" annulée (impact caisse neutralisé)`,
        color: 'orange'
      });

      await chargerCharges();
    } catch (error) {
      console.error('Erreur annulation:', error);
      notifications.show({
        title: '❌ Erreur',
        message: "Impossible d'annuler la charge",
        color: 'red'
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

  const filteredCharges = charges;
  const totalPages = Math.ceil(filteredCharges.length / itemsPerPage);
  const paginatedCharges = filteredCharges.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
      <Paper className="tk-page-tools" p="xl" radius="lg">
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={45} radius="md" color="red" variant="filled">
              <IconMoneybag size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Charges de fonctionnement</Title>
              <Text c="gray.3" size="sm">Gestion des charges et dépenses</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={chargerCharges}
            >
              Actualiser
            </Button>
            <Button
              variant="filled"
              color="red"
              leftSection={<IconPlus size={18} />}
              onClick={() => {
                setEditing(null);
                setFormData({ designation: '', montant: 0, beneficiaire: '', categorie_charge: 'AUTRE', reference_paiement: '', notes: '' });
                setModalOpened(true);
              }}
            >
              Ajouter une charge
            </Button>
          </Group>
        </Flex>

        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconCash size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Solde actuel</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(soldeActuel)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="red" variant="light" size="lg">
                <IconMoneybag size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Total charges</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(recap?.total_charges || 0)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconCalendar size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Aujourd'hui</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(recap?.total_charges_jour || 0)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="blue" variant="light" size="lg">
                <IconCalendar size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Ce mois-ci</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(recap?.total_charges_mois || 0)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconList size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Nombre</Text>
                <Text c="white" fw={700} size="xl">{charges.length}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* FILTRES */}
      <TkFilters>
      <Card withBorder radius="lg" shadow="sm" p="sm">
        <Grid align="flex-end">
          <Grid.Col span={3}>
            <TextInput
              label="Rechercher"
              placeholder="Désignation ou bénéficiaire..."
              leftSection={<IconSearch size={14} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select
              label="Catégorie"
              placeholder="Toutes"
              data={categoriesCharges.map(c => ({ value: c.value, label: c.label }))}
              value={selectedCategorie}
              onChange={setSelectedCategorie}
              clearable
              searchable
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <TextInput
              label="Date début"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <TextInput
              label="Date fin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <Group justify="flex-end" gap="xs">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconRefresh size={14} />}
                onClick={chargerCharges}
                size="xs"
              >
                Filtrer
              </Button>
              <Button
                variant="light"
                color="gray"
                leftSection={<IconX size={14} />}
                onClick={resetFilters}
                size="xs"
              >
                Effacer
              </Button>
              <Button
                variant="filled"
                color="red"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setEditing(null);
                  setFormData({
                    designation: '',
                    montant: 0,
                    beneficiaire: '',
                    categorie_charge: 'AUTRE',
                    reference_paiement: '',
                    notes: ''
                  });
                  setModalOpened(true);
                }}
                size="xs"
              >
                Nouvelle
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>
      </TkFilters>

      {/* RÉCAPITULATIF PAR CATÉGORIE */}
      {recap && Object.keys(recap.par_categorie).length > 0 && (
        <Card withBorder radius="lg" shadow="sm" p="sm">
          <Text fw={600} size="xs" mb="xs">Répartition par catégorie</Text>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
            {Object.entries(recap.par_categorie).map(([categorie, total]) => {
              const info = getCategorieInfo(categorie);
              return (
                <Paper key={categorie} p="xs" withBorder>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Text size="sm">{info.icon}</Text>
                      <Text size="xs" fw={500}>{info.label}</Text>
                    </Group>
                    <Text fw={700} c="red" size="sm">{formatMontant(total)} F</Text>
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Card>
      )}

      {/* TABLEAU */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <ScrollArea h={450}>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>N°</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Désignation</Table.Th>
                <Table.Th>Bénéficiaire</Table.Th>
                <Table.Th>Catégorie</Table.Th>
                <Table.Th ta="right">Montant</Table.Th>
                <Table.Th ta="center" w={120}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedCharges.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} align="center">
                    <Text c="dimmed" py={40}>Aucune charge trouvée</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                paginatedCharges.map((charge, idx) => {
                  const num = (currentPage - 1) * itemsPerPage + idx + 1;
                  const info = getCategorieInfo(charge.categorie_charge);
                  const estAnnulee = !!(charge as any).est_annule;
                  return (
                    <Table.Tr key={charge.idCharge} style={estAnnulee ? { backgroundColor: '#f1f3f5', opacity: 0.6, textDecoration: 'line-through' } : undefined}>
                      <Table.Td fw={600}>{num}</Table.Td>
                      <Table.Td>{formatDate(charge.date_charge)}</Table.Td>
                      <Table.Td>
                        <Group gap={6}>
                          <Text fw={500} size="xs">{charge.designation}</Text>
                          {estAnnulee && <Badge color="orange" variant="filled" size="xs">Annulé</Badge>}
                        </Group>
                        {charge.reference_paiement && (
                          <Text size="xs" c="dimmed">Réf: {charge.reference_paiement}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <IconUser size={12} color="#adb5bd" />
                          <Text size="xs">{charge.beneficiaire}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={info.color} variant="light" size="xs">
                          {info.icon} {info.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fw={600} c="red" size="xs">{formatMontant(charge.montant)} F</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Group gap={2} justify="center">
                          <Tooltip label="Détails">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => {
                                setSelectedCharge(charge);
                                setDetailsModalOpened(true);
                              }}
                            >
                              <IconEye size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Modifier">
                            <ActionIcon
                              variant="light"
                              color="orange"
                              size="sm"
                              onClick={() => handleEdit(charge)}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={estAnnulee ? 'Charge déjà annulée' : 'Annuler la charge'}>
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              disabled={estAnnulee}
                              onClick={() => handleDelete(charge.idCharge)}
                            >
                              <IconTrash size={14} />
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
        </ScrollArea>

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
          </Group>
        )}
      </Card>

      {/* MODAL AJOUT / MODIFICATION */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditing(null);
        }}
        title={editing ? 'Modifier la charge' : 'Ajouter une charge de fonctionnement'}
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1a1a2e', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
            Solde actuel: <strong>{formatMontant(soldeActuel)} FCFA</strong>
          </Alert>

          <Group align="flex-end" gap="xs" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              label="Désignation *"
              placeholder="Ex: Achat fournitures bureau"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              required
              size="xs"
            />
            <NumberInput
              w={130}
              label="Montant *"
              placeholder="0"
              value={formData.montant || ''}
              onChange={(val) => setFormData({ ...formData, montant: typeof val === 'number' ? val : 0 })}
              min={0}
              step={100}
              required
              hideControls
              thousandSeparator=" "
              size="xs"
              styles={{ input: { textAlign: 'right' } }}
            />
          </Group>

          <TextInput
            label="Bénéficiaire *"
            placeholder="Nom du bénéficiaire"
            value={formData.beneficiaire}
            onChange={(e) => setFormData({ ...formData, beneficiaire: e.target.value })}
            required
            size="xs"
          />

          <Group align="flex-end" gap="xs" wrap="nowrap">
            <Select
              style={{ flex: 1 }}
              label="Catégorie"
              placeholder="Sélectionner une catégorie"
              data={categoriesList.map(c => ({ value: c.value, label: c.label }))}
              value={formData.categorie_charge}
              onChange={(value) => setFormData({ ...formData, categorie_charge: value || 'AUTRE' })}
              size="xs"
              searchable
            />
            <Tooltip label="Ajouter une catégorie">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => setNewCatModalOpen(true)}
              >
                Catégorie
              </Button>
            </Tooltip>
          </Group>

          <TextInput
            label="Référence de paiement"
            placeholder="N° de chèque, virement, etc."
            value={formData.reference_paiement}
            onChange={(e) => setFormData({ ...formData, reference_paiement: e.target.value })}
            size="xs"
          />

          <Textarea
            label="Notes"
            placeholder="Informations complémentaires"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            size="xs"
          />

          <Divider />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => {
              setModalOpened(false);
              setEditing(null);
            }} size="xs">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              loading={saving}
              color="red"
              leftSection={editing ? <IconEdit size={14} /> : <IconPlus size={14} />}
              size="xs"
            >
              {editing ? 'Modifier' : 'Ajouter'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL DÉTAILS */}
      <Modal
        opened={detailsModalOpened}
        onClose={() => setDetailsModalOpened(false)}
        title="Détails de la charge"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1a1a2e', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        {selectedCharge && (
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="xs" c="dimmed">Code</Text>
                <Text fw={600}>{selectedCharge.code_charge}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Date</Text>
                <Text>{formatDate(selectedCharge.date_charge)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Désignation</Text>
                <Text fw={500}>{selectedCharge.designation}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Bénéficiaire</Text>
                <Text>{selectedCharge.beneficiaire}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Catégorie</Text>
                <Badge color={getCategorieInfo(selectedCharge.categorie_charge).color} variant="light">
                  {getCategorieInfo(selectedCharge.categorie_charge).label}
                </Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">Montant</Text>
                <Text fw={700} c="red">{formatMontant(selectedCharge.montant)} FCFA</Text>
              </div>
            </SimpleGrid>

            {selectedCharge.reference_paiement && (
              <div>
                <Text size="xs" c="dimmed">Référence paiement</Text>
                <Text>{selectedCharge.reference_paiement}</Text>
              </div>
            )}

            {selectedCharge.notes && (
              <div>
                <Text size="xs" c="dimmed">Notes</Text>
                <Text>{selectedCharge.notes}</Text>
              </div>
            )}
          </Stack>
        )}
      </Modal>

      {/* Modal : ajouter une catégorie de charge */}
      <Modal
        opened={newCatModalOpen}
        onClose={() => { setNewCatModalOpen(false); setNewCatLabel(''); }}
        title="Nouvelle catégorie de charge"
        size="sm"
        centered
      >
        <Stack>
          <TextInput
            label="Nom de la catégorie"
            placeholder="Ex : Maintenance, Fournitures, Impôts…"
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.currentTarget.value)}
            data-autofocus
            required
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => { setNewCatModalOpen(false); setNewCatLabel(''); }}>
              Annuler
            </Button>
            <Button onClick={handleAddCategorie} loading={addingCat} leftSection={<IconPlus size={16} />}>
              Ajouter
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default ChargesFonctionnement;
