// src/components/decomptes/ListeDecomptesRevendeur.tsx
import React, { useEffect, useState } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table, Badge,
  ActionIcon, Box, Pagination, Tooltip, Modal, Divider,
  ThemeIcon, SimpleGrid, TextInput, Paper, Flex, Avatar, Loader,
  Select, NumberInput,
  Grid
} from '@mantine/core';
import {
  IconFileText, IconEye, IconInfoCircle, IconCalendar,
  IconCash, IconPlus, IconClock, IconSearch, IconRefresh,
  IconReceipt, IconCurrencyFrank, IconTruck, IconEdit, IconTrash,
  IconCheck, IconX, IconAlertCircle,
  IconDownload,
  IconFileInvoice,
  IconPackage,
  IconUser
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';

interface ProduitRevendeur {
  idProduitRevendeur: number;
  idCommande: number;
  codeFacture: string;
  dateEntree: string;
  idProduit: number;
  codeProduit: string;
  categorie: string;
  designation: string;
  uniteMesure: string;
  quantiteInitiale: number;
  quantiteVendue: number;
  quantiteRestante: number;
  prixAchat: number;
  prixVente: number;
  idRevendeur: number;
  clientNom: string;
  clientSociete: string;
}

interface DecompteItem {
  idProduitRevendeur: number;
  idProduit: number;
  designation: string;
  codeProduit: string;
  categorie: string;
  uniteMesure: string;
  quantiteInitiale: number;
  quantiteVendue: number;
  quantiteRestante: number;
  qteDecompte: number;
  prixAchat: number;
  prixVente: number;
  total: number;
  commission: number;
}

const ListeDecomptesRevendeur: React.FC = () => {
  const [produits, setProduits] = useState<ProduitRevendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [codeFactureFiltre, setCodeFactureFiltre] = useState("");
  const [clientFiltre, setClientFiltre] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [decompteModalOpen, setDecompteModalOpen] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<ProduitRevendeur | null>(null);
  const [qteDecompte, setQteDecompte] = useState(1);
  const [loadingDecompte, setLoadingDecompte] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [selectedDecompte, setSelectedDecompte] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  
  const itemsPerPage = 10;

  // Charger les produits revendeurs avec quantités
  const chargerProduits = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      
      // Calculer les quantités vendues et restantes
      const result = await db.select<any[]>(`
        SELECT 
          pr.idProduitRevendeur,
          pr.idCommande,
          pr.code_facture as codeFacture,
          pr.date_entree as dateEntree,
          pr.idProduit,
          pr.code_produit as codeProduit,
          pr.categorie,
          pr.designation,
          pr.unite_mesure as uniteMesure,
          pr.qte_stock as quantiteInitiale,
          COALESCE((
            SELECT SUM(dd.QteDecompte) 
            FROM decompte_details dd 
            WHERE dd.idProduit = pr.idProduit 
            AND dd.idRevendeur = pr.idRevendeur
          ), 0) as quantiteVendue,
          pr.qte_stock - COALESCE((
            SELECT SUM(dd.QteDecompte) 
            FROM decompte_details dd 
            WHERE dd.idProduit = pr.idProduit 
            AND dd.idRevendeur = pr.idRevendeur
          ), 0) as quantiteRestante,
          pr.prix_achat as prixAchat,
          pr.prix_vente as prixVente,
          pr.idRevendeur,
          cl.NomComplet as clientNom,
          cl.Societe as clientSociete
        FROM produits_revendeur pr
        LEFT JOIN clients cl ON pr.idRevendeur = cl.idClient
        ORDER BY pr.date_entree DESC
      `);
      
      setProduits(result || []);
    } catch (error) {
      console.error("Erreur chargement:", error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerProduits();
  }, []);

  // Filtrage
  const produitsFiltres = produits.filter(p => {
    const matchRecherche = recherche === "" ||
      p.designation?.toLowerCase().includes(recherche.toLowerCase()) ||
      p.clientNom?.toLowerCase().includes(recherche.toLowerCase()) ||
      p.codeProduit?.toLowerCase().includes(recherche.toLowerCase());
    const matchCodeFacture = codeFactureFiltre === "" ||
      p.codeFacture?.toLowerCase().includes(codeFactureFiltre.toLowerCase());
    const matchClient = clientFiltre === "" ||
      p.clientNom?.toLowerCase().includes(clientFiltre.toLowerCase());
    return matchRecherche && matchCodeFacture && matchClient;
  });

  // Statistiques
  const stats = {
    totalProduits: produits.length,
    totalVente: produits.reduce((sum, p) => sum + (p.quantiteVendue * p.prixVente), 0),
    totalCommission: produits.reduce((sum, p) => sum + ((p.quantiteVendue * p.prixVente - p.quantiteVendue * p.prixAchat) * 0.6), 0),
    totalBenefice: produits.reduce((sum, p) => sum + (p.quantiteVendue * (p.prixVente - p.prixAchat)), 0)
  };

  const totalPages = Math.ceil(produitsFiltres.length / itemsPerPage);
  const paginatedProduits = produitsFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  // Ouvrir modal de décompte
  const handleDecompte = (produit: ProduitRevendeur) => {
    setSelectedProduit(produit);
    setQteDecompte(1);
    setDecompteModalOpen(true);
  };

  // Valider le décompte
  const validerDecompte = async () => {
    if (!selectedProduit) return;
    
    if (qteDecompte <= 0) {
      notifications.show({ title: 'Erreur', message: 'Quantité invalide', color: 'red' });
      return;
    }
    
    if (qteDecompte > selectedProduit.quantiteRestante) {
      notifications.show({ title: 'Erreur', message: 'Stock insuffisant', color: 'red' });
      return;
    }
    
    setLoadingDecompte(true);
    try {
      const db = await getDb();
      const totalVente = qteDecompte * selectedProduit.prixVente;
      const benefice = qteDecompte * (selectedProduit.prixVente - selectedProduit.prixAchat);
      const commission = benefice * 0.6;
      
      // 1. Créer ou mettre à jour un décompte
      let decompte = await db.select<any[]>(`
        SELECT idDecompte FROM decomptes 
        WHERE idClient = ? AND statut = 'EN_ATTENTE'
      `, [selectedProduit.idRevendeur]);
      
      let idDecompte;
      if (decompte.length === 0) {
        const codeRecu = `DCP-${Date.now()}`;
        const result = await db.execute(`
          INSERT INTO decomptes (idClient, date_decompte, code_recu, statut)
          VALUES (?, date('now'), ?, 'EN_ATTENTE')
        `, [selectedProduit.idRevendeur, codeRecu]);
        idDecompte = result.lastInsertId;
      } else {
        idDecompte = decompte[0].idDecompte;
      }
      
      // 2. Ajouter le détail
      await db.execute(`
        INSERT INTO decompte_details (
          idDecompte, idProduit, idRevendeur, QteDecompte, PrixUnitaireVente
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        idDecompte,
        selectedProduit.idProduit,
        selectedProduit.idRevendeur,
        qteDecompte,
        selectedProduit.prixVente
      ]);
      
      // 3. Mettre à jour les totaux du décompte
      const details = await db.select(`
        SELECT SUM(QteDecompte * PrixUnitaireVente) as total FROM decompte_details WHERE idDecompte = ?
      `, [idDecompte]);
      
      const totalTTC = details[0]?.total || 0;
      const totalHT = totalTTC / 1.18;
      
      await db.execute(`
        UPDATE decomptes SET montant_ht = ?, montant_ttc = ? WHERE idDecompte = ?
      `, [totalHT, totalTTC, idDecompte]);
      
      notifications.show({
        title: 'Succès',
        message: `${qteDecompte} x ${selectedProduit.designation} décompté avec succès`,
        color: 'green',
      });
      
      setDecompteModalOpen(false);
      chargerProduits();
      
    } catch (error: any) {
      notifications.show({ title: 'Erreur', message: error.message, color: 'red' });
    } finally {
      setLoadingDecompte(false);
    }
  };

  const resetFilters = () => {
    setRecherche('');
    setCodeFactureFiltre('');
    setClientFiltre('');
    setCurrentPage(1);
  };

  if (loading && produits.length === 0) {
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
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={50} radius="md" color="white" variant="light">
                  <IconFileText size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Gestion des Décomptes</Title>
                  <Text c="gray.3" size="sm">Gestion des décomptes revendeurs</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>
                Instructions
              </Button>
              <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={chargerProduits}>
                Actualiser
              </Button>
            </Group>
          </Flex>

          {/* Cartes statistiques */}
          <SimpleGrid cols={4} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="white" variant="light" size="lg"><IconPackage size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Produits</Text><Text c="white" fw={700} size="xl">{stats.totalProduits}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="green" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Chiffre d'affaires</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalVente)} F</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconCash size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Bénéfice</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalBenefice)} F</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="orange" variant="light" size="lg"><IconReceipt size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Commission</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalCommission)} F</Text></div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* SECTION RECHERCHE */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between" mb="md">
            <Group><IconSearch size={20} color="#1b365d" /><Title order={3} size="h4">Rechercher</Title></Group>
            <Button variant="light" color="gray" onClick={resetFilters} size="xs" leftSection={<IconX size={14} />}>Réinitialiser</Button>
          </Group>
          <Grid>
            <Grid.Col span={4}>
              <TextInput label="Nom du client" placeholder="Rechercher par client..." value={clientFiltre} onChange={(e) => setClientFiltre(e.target.value)} leftSection={<IconUser size={16} />} size="md" />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="Code facture" placeholder="Rechercher par code facture..." value={codeFactureFiltre} onChange={(e) => setCodeFactureFiltre(e.target.value)} leftSection={<IconFileInvoice size={16} />} size="md" />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="Recherche" placeholder="Produit, code..." value={recherche} onChange={(e) => setRecherche(e.target.value)} leftSection={<IconSearch size={16} />} size="md" />
            </Grid.Col>
          </Grid>
        </Card>

        {/* BOUTONS D'ACTION */}
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Group>
            <Button leftSection={<IconReceipt size={18} />} variant="filled" color="adminBlue">Générer reçu</Button>
            <Button leftSection={<IconRefresh size={18} />} variant="light" onClick={chargerProduits}>Actualiser</Button>
            <Button leftSection={<IconEye size={18} />} variant="light" color="teal">Voir les produits non vendus</Button>
            <Button leftSection={<IconPlus size={18} />} variant="filled" color="green">Nouveau décompte</Button>
          </Group>
        </Card>

        {/* EN-TÊTE LISTE */}
        <Group justify="space-between" align="center">
          <Title order={3} size="h4">Liste des décomptes</Title>
          <Button variant="subtle" rightSection={<IconDownload size={16} />} size="sm">Exporter</Button>
        </Group>

        {/* TABLEAU PRINCIPAL */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                  <Table.Th w={40}>N°</Table.Th>
                  <Table.Th>Nom du client</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>CodeFacture</Table.Th>
                  <Table.Th>Catégorie</Table.Th>
                  <Table.Th>Désignation</Table.Th>
                  <Table.Th ta="center">Qté Initale</Table.Th>
                  <Table.Th ta="center">Qté vendue</Table.Th>
                  <Table.Th ta="center">Qté restante</Table.Th>
                  <Table.Th ta="right">Prix Achat</Table.Th>
                  <Table.Th ta="right">Prix Vente</Table.Th>
                  <Table.Th ta="right">Total Vente</Table.Th>
                  <Table.Th ta="right">Total Achat</Table.Th>
                  <Table.Th ta="right">Bénéfice</Table.Th>
                  <Table.Th ta="right">Commission</Table.Th>
                  <Table.Th ta="center" w={100}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedProduits.map((p, index) => {
                  const num = (currentPage - 1) * itemsPerPage + index + 1;
                  const totalVente = p.quantiteVendue * p.prixVente;
                  const totalAchat = p.quantiteVendue * p.prixAchat;
                  const benefice = totalVente - totalAchat;
                  const commission = benefice * 0.6;
                  
                  return (
                    <Table.Tr key={p.idProduitRevendeur}>
                      <Table.Td>{num}</Table.Td>
                      <Table.Td fw={500}>{p.clientNom || p.clientSociete || '-'}</Table.Td>
                      <Table.Td>{new Date(p.dateEntree).toLocaleDateString('fr-FR')}</Table.Td>
                      <Table.Td><Text size="xs" fw={500}>{p.codeFacture || '-'}</Text></Table.Td>
                      <Table.Td>{p.categorie || '-'}</Table.Td>
                      <Table.Td fw={500}>{p.designation}</Table.Td>
                      <Table.Td ta="center">{p.quantiteInitiale}</Table.Td>
                      <Table.Td ta="center">{p.quantiteVendue}</Table.Td>
                      <Table.Td ta="center">
                        <Badge color={p.quantiteRestante <= 0 ? 'red' : p.quantiteRestante <= 5 ? 'orange' : 'green'} variant="light">
                          {p.quantiteRestante}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">{formatMontant(p.prixAchat)}</Table.Td>
                      <Table.Td ta="right">{formatMontant(p.prixVente)}</Table.Td>
                      <Table.Td ta="right">{formatMontant(totalVente)}</Table.Td>
                      <Table.Td ta="right">{formatMontant(totalAchat)}</Table.Td>
                      <Table.Td ta="right" c="green">{formatMontant(benefice)}</Table.Td>
                      <Table.Td ta="right" c="orange">{formatMontant(commission)}</Table.Td>
                      <Table.Td ta="center">
                        <Group gap={4} justify="center">
                          <Tooltip label="Décompter">
                            <ActionIcon variant="light" color="blue" size="md" onClick={() => handleDecompte(p)} disabled={p.quantiteRestante === 0}>
                              <IconCash size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Modifier">
                            <ActionIcon variant="light" color="adminBlue" size="md">
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Supprimer">
                            <ActionIcon variant="light" color="red" size="md">
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>

          {produitsFiltres.length === 0 && (
            <Flex justify="center" align="center" direction="column" py={60}>
              <IconFileText size={60} color="#ccc" />
              <Text ta="center" c="dimmed" mt="md">Aucun produit trouvé</Text>
            </Flex>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL DÉCOMPTE */}
      <Modal
        opened={decompteModalOpen}
        onClose={() => setDecompteModalOpen(false)}
        title={`Décompter - ${selectedProduit?.designation || ''}`}
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        {selectedProduit && (
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <Card withBorder p="sm" bg="gray.0">
                <Text size="xs" c="dimmed">Produit</Text>
                <Text fw={500}>{selectedProduit.designation}</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0">
                <Text size="xs" c="dimmed">Stock restant</Text>
                <Text fw={700} c="green">{selectedProduit.quantiteRestante}</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0">
                <Text size="xs" c="dimmed">Prix de vente</Text>
                <Text fw={600}>{formatMontant(selectedProduit.prixVente)} F</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0">
                <Text size="xs" c="dimmed">Client</Text>
                <Text>{selectedProduit.clientNom}</Text>
              </Card>
            </SimpleGrid>

            <Divider />

            <NumberInput
              label="Quantité à décompter"
              value={qteDecompte}
              onChange={(val) => setQteDecompte(Number(val) || 1)}
              min={1}
              max={selectedProduit.quantiteRestante}
              required
              size="md"
            />

            <Card withBorder p="sm" bg="green.0">
              <Group justify="space-between">
                <Text fw={700}>Total à payer :</Text>
                <Text fw={800} size="xl" c="green">{formatMontant(qteDecompte * selectedProduit.prixVente)} F</Text>
              </Group>
            </Card>

            <Divider />

            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setDecompteModalOpen(false)}>Annuler</Button>
              <Button color="green" onClick={validerDecompte} loading={loadingDecompte}>Valider décompte</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* MODAL INSTRUCTIONS */}
      <Modal
        opened={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title="📋 Instructions"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <Text size="sm">1. Cette liste montre tous les produits des revendeurs</Text>
          <Text size="sm">2. La colonne "Qté restante" montre le stock disponible</Text>
          <Text size="sm">3. Cliquez sur l'icône 💰 pour décompter des produits</Text>
          <Text size="sm">4. Les commissions sont calculées automatiquement (60% du bénéfice)</Text>
          <Divider />
          <Text size="xs" c="dimmed" ta="center">Version 2.0.0 - Gestion Commerciale Pro</Text>
        </Stack>
      </Modal>
    </>
  );
};

export default ListeDecomptesRevendeur;