// src/components/decomptes/ListeDecomptes.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Group, Stack, Title, Card, Text,
  Modal, TextInput, Paper,
  Loader, ThemeIcon, Flex, ActionIcon,
  ScrollArea, Pagination, Tooltip, Select, Badge, Table, SimpleGrid,
  Alert, Divider
} from '@mantine/core';
import {
  IconSearch, IconRefresh, IconReceipt,
  IconX, IconEye,
  IconPrinter, IconFilter, IconList, IconPlus, IconArrowBackUp, IconFileInvoice,
  IconCalendar, IconPackage, IconTrash, IconAlertCircle
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import NouveauDecompte from './NouveauDecompte';
import ListeCommandesRevendeur from '../commandes/ListeCommandesRevendeur';
import RecuDecompte from './RecuDecompte';
interface DetailDecompte {
  idDecompte: number;
  code_decompte: string;
  date_decompte: string;
  client_nom: string;
  client_societe: string;
  client_tel: string;
  produit_designation: string;
  produit_categorie: string;
  code_facture: string;
  quantite_decompte: number;
  quantite_vendue: number;
  quantite_restante: number;
  prix_achat: number;
  prix_vente: number;
  total_achat: number;
  total_vente: number;
  benefice: number;
  commission: number;
  taux_commission: number;
}

interface GroupedDecompte {
  idDecompte: number;
  code_decompte: string;
  date_decompte: string;
  client_nom: string;
  client_societe: string;
  client_tel: string;
  code_facture: string;
  montant_vente: number;
  montant_commission: number;
  montant_net: number;
  taux_commission: number;
  produits: DetailDecompte[];
}

export const ListeDecomptes: React.FC = () => {
  const navigate = useNavigate();
  const [decomptes, setDecomptes] = useState<GroupedDecompte[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedCodeFacture, setSelectedCodeFacture] = useState<string | null>(null);
  const [clientsList, setClientsList] = useState<{ value: string; label: string }[]>([]);
  const [codeFacturesList, setCodeFacturesList] = useState<{ value: string; label: string }[]>([]);
  const [dateDebut, setDateDebut] = useState<Date | null>(null);
  const [dateFin, setDateFin] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [nouveauDecompteModalOpen, setNouveauDecompteModalOpen] = useState(false);
  const [stocksRevendeurModalOpen, setStocksRevendeurModalOpen] = useState(false);
  const [selectedDecompte, setSelectedDecompte] = useState<GroupedDecompte | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [showNonVendus, setShowNonVendus] = useState(false);
  const [nonVendusData, setNonVendusData] = useState<any[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [decompteToDelete, setDecompteToDelete] = useState<GroupedDecompte | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const itemsPerPage = 10;

  // Charger les décomptes groupés
  const chargerDecomptes = async () => {
    setLoading(true);
    try {
      const db = await getDb();

      // Vérifier d'abord la structure de la table
      const factureColumns = await db.select<any[]>(`
        PRAGMA table_info(factures_revendeur)
      `);
      
      const codeFactureColumn = factureColumns.find(col => 
        col.name === 'code_facture' || 
        col.name === 'code' || 
        col.name === 'facture_code'
      )?.name || 'code_facture';

      const result = await db.select<any[]>(`
        SELECT 
          d.idDecompte,
          d.code_decompte,
          d.date_decompte,
          c.NomComplet as client_nom,
          c.Societe as client_societe,
          c.Tel as client_tel,
          fr.${codeFactureColumn} as code_facture,
          d.montant_vente,
          d.montant_commission,
          d.montant_net,
          d.taux_commission,
          dd.idProduit,
          p.designation as produit_designation,
          p.categorie as produit_categorie,
          dd.qte_decompte,
          dd.prix_achat,
          dd.prix_vente,
          dd.benefice,
          dd.commission
        FROM decomptes d
        INNER JOIN clients c ON c.idClient = d.idClient
        LEFT JOIN factures_revendeur fr ON fr.idFactureRevendeur = d.idFactureRevendeur
        LEFT JOIN decompte_details dd ON dd.idDecompte = d.idDecompte
        LEFT JOIN products p ON p.idProduit = dd.idProduit
        ORDER BY d.date_decompte DESC
      `);

      // Grouper par décompte
      const grouped = new Map<number, GroupedDecompte>();
      
      for (const row of result) {
        if (!grouped.has(row.idDecompte)) {
          grouped.set(row.idDecompte, {
            idDecompte: row.idDecompte,
            code_decompte: row.code_decompte,
            date_decompte: row.date_decompte,
            client_nom: row.client_nom,
            client_societe: row.client_societe,
            client_tel: row.client_tel,
            code_facture: row.code_facture,
            montant_vente: row.montant_vente || 0,
            montant_commission: row.montant_commission || 0,
            montant_net: row.montant_net || 0,
            taux_commission: row.taux_commission || 0,
            produits: []
          });
        }
        
        if (row.idProduit) {
          grouped.get(row.idDecompte)!.produits.push({
            idDecompte: row.idDecompte,
            code_decompte: row.code_decompte,
            date_decompte: row.date_decompte,
            client_nom: row.client_nom,
            client_societe: row.client_societe,
            client_tel: row.client_tel,
            produit_designation: row.produit_designation,
            produit_categorie: row.produit_categorie,
            code_facture: row.code_facture,
            quantite_decompte: row.qte_decompte,
            quantite_vendue: 0,
            quantite_restante: 0,
            prix_achat: row.prix_achat,
            prix_vente: row.prix_vente,
            total_achat: (row.prix_achat || 0) * (row.qte_decompte || 0),
            total_vente: (row.prix_vente || 0) * (row.qte_decompte || 0),
            benefice: row.benefice || 0,
            commission: row.commission || 0,
            taux_commission: row.taux_commission || 0
          } as DetailDecompte);
        }
      }

      const decomptesArray = Array.from(grouped.values());
      setDecomptes(decomptesArray);

      // Extraire les listes pour les filtres
      const uniqueClients = [...new Map(decomptesArray.map(d => [d.client_nom, {
        value: d.client_nom,
        label: d.client_nom
      }])).values()];
      setClientsList(uniqueClients);

      const uniqueCodeFactures = [...new Map(decomptesArray
        .filter(d => d.code_facture)
        .map(d => [d.code_facture, {
          value: d.code_facture,
          label: d.code_facture
        }])).values()];
      setCodeFacturesList(uniqueCodeFactures);

    } catch (error) {
      console.error('Erreur chargement décomptes:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // Charger les produits non vendus
  const chargerProduitsNonVendus = async () => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT 
          sr.idProduit,
          p.designation,
          p.code_produit,
          p.categorie,
          sr.qte_stock,
          sr.prix_achat,
          sr.prix_vente,
          c.NomComplet as client_nom,
          c.Societe as client_societe
        FROM stock_revendeur sr
        INNER JOIN products p ON p.idProduit = sr.idProduit
        INNER JOIN clients c ON c.idClient = sr.idRevendeur
        WHERE sr.qte_stock > 0
        ORDER BY c.NomComplet, p.designation
      `);
      setNonVendusData(result);
      setShowNonVendus(true);
    } catch (error) {
      console.error('Erreur chargement produits non vendus:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    }
  };

  // ✅ Vérifier si un décompte peut être supprimé
  const peutSupprimerDecompte = async (idDecompte: number): Promise<{ peut: boolean; raison: string }> => {
    const db = await getDb();

    // Vérifier s'il y a des règlements associés à ce décompte
    const reglements = await db.select<any[]>(`
      SELECT COUNT(*) as count
      FROM reglements
      WHERE idDecompte = ?
    `, [idDecompte]);

    if (reglements[0]?.count > 0) {
      return { peut: false, raison: 'Des règlements ont déjà été effectués sur ce décompte' };
    }

    return { peut: true, raison: '' };
  };

  // ✅ Supprimer un décompte avec restauration du stock
  const supprimerDecompte = async () => {
    if (!decompteToDelete) return;

    // Vérifier si le décompte peut être supprimé
    const { peut, raison } = await peutSupprimerDecompte(decompteToDelete.idDecompte);
    
    if (!peut) {
      notifications.show({
        title: '❌ Suppression impossible',
        message: raison,
        color: 'red',
        autoClose: 8000
      });
      setDeleteModalOpen(false);
      setDecompteToDelete(null);
      return;
    }

    setDeleteLoading(true);
    
    try {
      const db = await getDb();

      // 1. Récupérer les détails du décompte pour restaurer le stock
      const details = await db.select<any[]>(`
        SELECT idProduit, qte_decompte FROM decompte_details WHERE idDecompte = ?
      `, [decompteToDelete.idDecompte]);

      // 2. Restaurer le stock pour chaque produit
      for (const detail of details) {
        await db.execute(`
          UPDATE stock_revendeur 
          SET qte_stock = qte_stock + ? 
          WHERE idProduit = ? AND idRevendeur = ?
        `, [
          detail.qte_decompte, 
          detail.idProduit, 
          decompteToDelete.idDecompte
        ]);
      }

      // 3. Supprimer les détails du décompte
      await db.execute(`DELETE FROM decompte_details WHERE idDecompte = ?`, [decompteToDelete.idDecompte]);

      // 4. Supprimer le décompte
      await db.execute(`DELETE FROM decomptes WHERE idDecompte = ?`, [decompteToDelete.idDecompte]);

      notifications.show({
        title: '✅ Succès',
        message: `Décompte ${decompteToDelete.code_decompte} supprimé avec succès - Stock restauré (${details.length} produit(s))`,
        color: 'green',
      });
      
      setDeleteModalOpen(false);
      setDecompteToDelete(null);
      chargerDecomptes();
      
    } catch (error) {
      console.error("Erreur suppression:", error);
      notifications.show({
        title: '❌ Erreur',
        message: 'Erreur lors de la suppression du décompte',
        color: 'red',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    chargerDecomptes();
  }, []);

  // Filtrer les décomptes
  const decomptesFiltres = useMemo(() => {
    let filtered = [...decomptes];

    if (selectedClient) {
      filtered = filtered.filter(d => d.client_nom === selectedClient);
    }

    if (selectedCodeFacture) {
      filtered = filtered.filter(d => d.code_facture === selectedCodeFacture);
    }

    if (dateDebut) {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      filtered = filtered.filter(d => new Date(d.date_decompte) >= debut);
    }

    if (dateFin) {
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(d => new Date(d.date_decompte) <= fin);
    }

    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.client_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.client_societe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code_decompte?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code_facture?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [decomptes, selectedClient, selectedCodeFacture, dateDebut, dateFin, searchTerm]);

  const stats = {
    totalDecomptes: decomptesFiltres.length,
    totalVente: decomptesFiltres.reduce((sum, d) => sum + (d.montant_vente || 0), 0),
    totalCommission: decomptesFiltres.reduce((sum, d) => sum + (d.montant_commission || 0), 0),
    totalNet: decomptesFiltres.reduce((sum, d) => sum + (d.montant_net || 0), 0)
  };

  const totalPages = Math.ceil(decomptesFiltres.length / itemsPerPage);
  const paginatedDecomptes = decomptesFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSelectedClient(null);
    setSelectedCodeFacture(null);
    setDateDebut(null);
    setDateFin(null);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const handleNouveauDecompteSuccess = () => {
    setNouveauDecompteModalOpen(false);
    chargerDecomptes();
    notifications.show({ title: '✅ Succès', message: 'Décompte créé avec succès', color: 'green' });
  };

  const handleRetourFacturesRevendeur = () => {
    navigate('/factures-revendeur');
  };

  const handleGenererRecu = (decompte: GroupedDecompte) => {
    setSelectedDecompte(decompte);
    setPrintModalOpen(true);
  };

  const handleGenererRecuPeriode = () => {
    if (decomptesFiltres.length === 0) {
      notifications.show({ title: 'Information', message: 'Aucun décompte à imprimer', color: 'blue' });
      return;
    }
    notifications.show({ title: 'Information', message: 'Impression récapitulative des décomptes de la période', color: 'blue' });
  };

  if (loading && decomptes.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des décomptes...</Text>
      </Card>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        {/* EN-TÊTE */}
        <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
          <Flex justify="space-between" align="center" wrap="wrap">
            <Group gap="md">
              <ThemeIcon size={50} radius="md" color="white" variant="light">
                <IconReceipt size={30} />
              </ThemeIcon>
              <div>
                <Title order={1} c="white" style={{ fontSize: '1.5rem' }}>GESTION DES DÉCOMPTES DES REVENDEURS</Title>
                <Text c="gray.3" size="sm">Suivi des ventes et commissions par revendeur</Text>
              </div>
            </Group>
            <Group>
              <Button variant="light" color="grape" leftSection={<IconFileInvoice size={18} />} onClick={handleRetourFacturesRevendeur}>
                Factures Revendeurs
              </Button>
              <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={chargerDecomptes}>
                Actualiser
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Total décomptes</Text>
              <Text c="white" fw={700} size="xl">{stats.totalDecomptes}</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Montant total ventes</Text>
              <Text c="white" fw={700} size="xl">{formatMontant(stats.totalVente)} F</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Commission totale</Text>
              <Text c="white" fw={700} size="xl">{formatMontant(stats.totalCommission)} F</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Net total</Text>
              <Text c="white" fw={700} size="xl">{formatMontant(stats.totalNet)} F</Text>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* BARRE DE RECHERCHE ET BOUTONS */}
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Stack gap="md">
            <Group grow>
              <TextInput
                placeholder="Rechercher par client, code décompte ou code facture..."
                leftSection={<IconSearch size={16} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="sm"
              />
              <Button
                variant={showFilters ? "filled" : "light"}
                color={showFilters ? "blue" : "gray"}
                leftSection={<IconFilter size={16} />}
                onClick={() => setShowFilters(!showFilters)}
                size="sm"
              >
                Filtres
              </Button>
              <Button variant="outline" color="gray" onClick={resetFilters} size="sm" leftSection={<IconX size={14} />}>
                Réinitialiser
              </Button>
            </Group>

            <Group grow>
              <Button leftSection={<IconArrowBackUp size={16} />} variant="light" color="blue" onClick={handleRetourFacturesRevendeur} size="sm">
                Factures Revendeurs
              </Button>
              <Button leftSection={<IconPackage size={16} />} variant="light" color="orange" onClick={chargerProduitsNonVendus} size="sm">
                Produits non vendus
              </Button>
              <Button leftSection={<IconList size={16} />} variant="light" onClick={() => setStocksRevendeurModalOpen(true)} size="sm">
                Stocks revendeurs
              </Button>
              <Button leftSection={<IconPlus size={16} />} variant="filled" color="green" onClick={() => setNouveauDecompteModalOpen(true)} size="sm">
                Nouveau décompte
              </Button>
            </Group>

            {/* PANEL DES FILTRES */}
            {showFilters && (
              <Paper withBorder p="md" radius="md" mt="md" bg="gray.0">
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                  <Select
                    label="Revendeur"
                    placeholder="Tous les revendeurs"
                    data={clientsList}
                    value={selectedClient}
                    onChange={setSelectedClient}
                    clearable
                    searchable
                    size="sm"
                  />
                  <Select
                    label="Code facture"
                    placeholder="Tous les codes"
                    data={codeFacturesList}
                    value={selectedCodeFacture}
                    onChange={setSelectedCodeFacture}
                    clearable
                    searchable
                    size="sm"
                  />
                  <TextInput
                    label="Date début"
                    placeholder="Sélectionner une date"
                    type="date"
                    value={dateDebut ? dateDebut.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDateDebut(val ? new Date(val) : null);
                    }}
                    size="sm"
                    leftSection={<IconCalendar size={14} />}
                  />
                  <TextInput
                    label="Date fin"
                    placeholder="Sélectionner une date"
                    type="date"
                    value={dateFin ? dateFin.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDateFin(val ? new Date(val) : null);
                    }}
                    size="sm"
                    leftSection={<IconCalendar size={14} />}
                  />
                </SimpleGrid>
                <Group justify="flex-end" mt="md">
                  <Button size="xs" variant="outline" onClick={resetFilters}>Tout effacer</Button>
                  <Button size="xs" variant="filled" color="teal" leftSection={<IconPrinter size={14} />} onClick={handleGenererRecuPeriode}>
                    Imprimer récapitulatif période
                  </Button>
                </Group>
              </Paper>
            )}
          </Stack>
        </Card>

        {/* TABLEAU DES DÉCOMPTES */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <ScrollArea h="calc(100vh - 480px)" type="auto">
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                <Table.Tr>
                  <Table.Th c="white" w={50}>N°</Table.Th>
                  <Table.Th c="white">Revendeur</Table.Th>
                  <Table.Th c="white">Date décompte</Table.Th>
                  <Table.Th c="white">Code décompte</Table.Th>
                  <Table.Th c="white">Code facture</Table.Th>
                  <Table.Th c="white" ta="right">Montant vente</Table.Th>
                  <Table.Th c="white" ta="right">Commission</Table.Th>
                  <Table.Th c="white" ta="right">Net à payer</Table.Th>
                  <Table.Th c="white" ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedDecomptes.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9} align="center">
                      <Stack align="center" py={50}>
                        <IconReceipt size={50} color="#ccc" />
                        <Text c="dimmed">Aucun décompte trouvé</Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  paginatedDecomptes.map((decompte, index) => {
                    const num = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <Table.Tr key={decompte.idDecompte}>
                        <Table.Td>
                          <Text fw={600} size="sm">{num}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label={decompte.client_tel}>
                            <Text fw={500} size="sm">{decompte.client_nom || decompte.client_societe || '-'}</Text>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{new Date(decompte.date_decompte).toLocaleDateString('fr-FR')}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm">{decompte.code_decompte}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">{decompte.code_facture || '-'}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} c="blue" size="sm">{formatMontant(decompte.montant_vente)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text c="orange" size="sm">{formatMontant(decompte.montant_commission)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} c="green" size="sm">{formatMontant(decompte.montant_net)} F</Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Group gap={4} justify="center">
                            <Tooltip label="Voir détails">
                              <ActionIcon variant="light" color="blue" size="md" onClick={() => navigate(`/decomptes/${decompte.idDecompte}`)}>
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Imprimer reçu">
                              <ActionIcon variant="light" color="green" size="md" onClick={() => handleGenererRecu(decompte)}>
                                <IconPrinter size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Supprimer">
                              <ActionIcon variant="light" color="red" size="md" onClick={() => {
                                setDecompteToDelete(decompte);
                                setDeleteModalOpen(true);
                              }}>
                                <IconTrash size={16} />
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
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL PRODUITS NON VENDUS */}
      <Modal
        opened={showNonVendus}
        onClose={() => setShowNonVendus(false)}
        size="90%"
        title="Produits non vendus par revendeur"
        centered
      >
        <ScrollArea h={500}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr style={{ background: '#1b365d' }}>
                <Table.Th c="white">Revendeur</Table.Th>
                <Table.Th c="white">Code</Table.Th>
                <Table.Th c="white">Produit</Table.Th>
                <Table.Th c="white">Catégorie</Table.Th>
                <Table.Th c="white" ta="center">Stock</Table.Th>
                <Table.Th c="white" ta="right">Prix achat</Table.Th>
                <Table.Th c="white" ta="right">Prix vente</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {nonVendusData.map((item, idx) => (
                <Table.Tr key={idx}>
                  <Table.Td fw={500}>{item.client_nom || item.client_societe}</Table.Td>
                  <Table.Td>{item.code_produit}</Table.Td>
                  <Table.Td>{item.designation}</Table.Td>
                  <Table.Td>{item.categorie || '-'}</Table.Td>
                  <Table.Td ta="center">
                    <Badge color="orange" variant="light">{item.qte_stock}</Badge>
                  </Table.Td>
                  <Table.Td ta="right">{formatMontant(item.prix_achat)} F</Table.Td>
                  <Table.Td ta="right">{formatMontant(item.prix_vente)} F</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        <Group justify="flex-end" mt="md">
          <Button onClick={() => setShowNonVendus(false)}>Fermer</Button>
        </Group>
      </Modal>

      {/* MODAL NOUVEAU DÉCOMPTE */}
      <Modal
        opened={nouveauDecompteModalOpen}
        onClose={() => setNouveauDecompteModalOpen(false)}
        size="95%"
        fullScreen
        padding={0}
        styles={{ body: { padding: 0 } }}
      >
        <NouveauDecompte onSuccess={handleNouveauDecompteSuccess} onCancel={() => setNouveauDecompteModalOpen(false)} />
      </Modal>

      {/* MODAL STOCKS REVENDEURS */}
      <Modal
        opened={stocksRevendeurModalOpen}
        onClose={() => setStocksRevendeurModalOpen(false)}
        size="95%"
        fullScreen
        padding={0}
        styles={{ body: { padding: 0 } }}
      >
        <ListeCommandesRevendeur />
      </Modal>

      {/* MODAL IMPRESSION REÇU */}
      <Modal
        opened={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        size="90%"
        title={`Reçu de décompte - ${selectedDecompte?.code_decompte || ''}`}
        centered
      >
        {selectedDecompte && (
          <RecuDecompte
            numero={selectedDecompte.code_decompte}
            date={selectedDecompte.date_decompte}
            client={selectedDecompte.client_nom || selectedDecompte.client_societe || ''}
            details={selectedDecompte.produits.map(p => ({
              idProduit: 0,
              codeFacture: selectedDecompte.code_facture || '',
              designation: p.produit_designation,
              qteInitiale: p.quantite_decompte,
              qteVendue: p.quantite_decompte,
              qteRestante: 0,
              prixAchat: p.prix_achat,
              prixVente: p.prix_vente,
              commissionPourcentage: selectedDecompte.taux_commission || 60
            }))}
            factureOriginale={{ 
              taux_commission_revendeur: selectedDecompte.taux_commission || 60 
            }}
          />
        )}
        <Group justify="flex-end" mt="md">
          <Button onClick={() => setPrintModalOpen(false)}>Fermer</Button>
        </Group>
      </Modal>

      {/* ✅ MODAL CONFIRMATION SUPPRESSION */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDecompteToDelete(null);
        }}
        title="⚠️ Suppression du décompte"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="⚠️ Attention !">
            <Text size="sm">
              Êtes-vous sûr de vouloir supprimer ce décompte ?
            </Text>
            <Text size="sm" mt="md" c="red">
              <strong>Action irréversible !</strong>
            </Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>Le décompte sera définitivement supprimé</li>
              <li>Les stocks revendeur seront restaurés</li>
              <li>Les commissions associées seront supprimées</li>
            </ul>
          </Alert>

          <Text size="sm" c="dimmed" ta="center">
            {decompteToDelete && `Décompte ${decompteToDelete.code_decompte} du ${new Date(decompteToDelete.date_decompte).toLocaleDateString('fr-FR')}`}
          </Text>

          <Divider />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading}>
              Annuler
            </Button>
            <Button 
              color="red" 
              onClick={supprimerDecompte} 
              loading={deleteLoading}
              leftSection={<IconTrash size={16} />}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default ListeDecomptes;