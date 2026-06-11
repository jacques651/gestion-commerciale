// src/components/commandes/ListeCommandesRevendeur.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Group, Badge, Stack, Title, Card, Text,
  Modal, Divider, TextInput, Grid,
  Paper, Box, SimpleGrid, Loader, ThemeIcon, Flex, NumberInput,
  ActionIcon,
  ScrollArea
} from '@mantine/core';
import {
  IconSearch, IconRefresh, IconPlus, IconDownload, IconReceipt,
  IconX, IconPackage, IconTruck, IconFileInvoice,
  IconCalculator, IconCurrencyFrank,
  IconTrash
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import FormulaireCommande from './FormulaireCommande';

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
  qteStock: number;
  quantiteInitiale: number;  // Ajouter
  quantiteVendue: number;     // Ajouter
  quantiteRestante: number;   // Ajouter
  prixAchat: number;
  prixVente: number;
  idRevendeur: number;
  clientNom: string;
  clientSociete: string;
  clientTel?: string;
}

export const ListeCommandesRevendeur: React.FC = () => {
  const [produits, setProduits] = useState<ProduitRevendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [codeFactureFiltre, setCodeFactureFiltre] = useState('');
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [commandeModalOpened, setCommandeModalOpened] = useState(false);
  const [selectedRevendeur, setSelectedRevendeur] = useState<ProduitRevendeur | null>(null);
  const [revendeurProduits, setRevendeurProduits] = useState<ProduitRevendeur[]>([]);
  const [panier, setPanier] = useState<any[]>([]);
  const [] = useState(false);
  const [] = useState<any>(null);
  const [decompteModalOpen, setDecompteModalOpen] = useState(false);
  const [loadingDecompte, setLoadingDecompte] = useState(false);
  const [quantites, setQuantites] = useState<Record<number, number>>({});

  const itemsPerPage = 10;

  // Charger les produits revendeurs avec calcul des quantités vendues
  const chargerProduits = async () => {
    setLoading(true);
    try {
      const db = await getDb();
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
        pr.qte_stock as qteStock,
        COALESCE((
          SELECT SUM(dd.QteDecompte) 
          FROM decompte_details dd 
          WHERE dd.idProduit = pr.idProduit 
          AND dd.idRevendeur = pr.idRevendeur
        ), 0) as quantiteVendue,
        pr.prix_achat as prixAchat,
        pr.prix_vente as prixVente,
        pr.idRevendeur,
        cl.NomComplet as clientNom,
        cl.Societe as clientSociete,
        cl.Tel as clientTel
      FROM produits_revendeur pr
      LEFT JOIN clients cl ON pr.idRevendeur = cl.idClient
      ORDER BY pr.date_entree DESC
    `);

      // Transformer les données pour avoir le stock restant cohérent
      const produitsAvecStock = (result || []).map(p => ({
        ...p,
        quantiteInitiale: p.qteStock,
        quantiteRestante: p.qteStock - (p.quantiteVendue || 0)
      }));

      setProduits(produitsAvecStock);
    } catch (error) {
      console.error('Erreur chargement:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerProduits();
  }, []);

  // Ouvrir le formulaire de décompte pour un revendeur
  const handleDecompte = async (produit: ProduitRevendeur) => {
    setSelectedRevendeur(produit);
    setLoadingDecompte(true);
    try {
      const db = await getDb();
      const produitsRevendeur = await db.select<any[]>(`
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
          pr.qte_stock as qteStock,
          pr.prix_achat as prixAchat,
          pr.prix_vente as prixVente,
          pr.idRevendeur,
          cl.NomComplet as clientNom,
          cl.Societe as clientSociete,
          cl.Tel as clientTel
        FROM produits_revendeur pr
        LEFT JOIN clients cl ON pr.idRevendeur = cl.idClient
        WHERE pr.idRevendeur = ? AND pr.qte_stock > 0
        ORDER BY pr.designation
      `, [produit.idRevendeur]);

      setRevendeurProduits(produitsRevendeur || []);
      setPanier([]);
      setQuantites({});
      setDecompteModalOpen(true);
    } catch (error) {
      console.error('Erreur chargement produits revendeur:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoadingDecompte(false);
    }
  };

  // Ajouter un produit au panier
  const ajouterAuPanier = (produit: ProduitRevendeur, quantite: number) => {
    if (quantite <= 0) {
      notifications.show({ title: 'Erreur', message: 'Quantité invalide', color: 'red' });
      return;
    }
    if (quantite > produit.qteStock) {
      notifications.show({ title: 'Erreur', message: 'Stock insuffisant', color: 'red' });
      return;
    }

    const existingIndex = panier.findIndex(p => p.idProduitRevendeur === produit.idProduitRevendeur);
    const total = quantite * produit.prixVente;
    const benefice = (produit.prixVente - produit.prixAchat) * quantite;
    const commission = benefice * 0.6;

    if (existingIndex >= 0) {
      const newQuantite = panier[existingIndex].qteDecompte + quantite;
      if (newQuantite > produit.qteStock) {
        notifications.show({ title: 'Erreur', message: 'Quantité totale dépasse le stock', color: 'red' });
        return;
      }
      const updated = [...panier];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qteDecompte: newQuantite,
        total: newQuantite * produit.prixVente,
        commission: ((produit.prixVente - produit.prixAchat) * newQuantite) * 0.6
      };
      setPanier(updated);
    } else {
      setPanier([...panier, {
        idProduitRevendeur: produit.idProduitRevendeur,
        idProduit: produit.idProduit,
        designation: produit.designation,
        codeProduit: produit.codeProduit,
        categorie: produit.categorie,
        uniteMesure: produit.uniteMesure || 'Unité',
        qteDisponible: produit.qteStock,
        qteDecompte: quantite,
        prixAchat: produit.prixAchat,
        prixVente: produit.prixVente,
        total: total,
        commission: commission
      }]);
    }
  };

  // Mettre à jour la quantité dans le panier
  const updateQuantite = (index: number, qte: number) => {
    const newPanier = [...panier];
    const item = newPanier[index];
    const produitOriginal = revendeurProduits.find(p => p.idProduitRevendeur === item.idProduitRevendeur);

    if (qte <= (produitOriginal?.qteStock || 0) && qte > 0) {
      newPanier[index].qteDecompte = qte;
      newPanier[index].total = qte * item.prixVente;
      const benefice = (item.prixVente - item.prixAchat) * qte;
      newPanier[index].commission = benefice * 0.6;
      setPanier(newPanier);
    } else if (qte > (produitOriginal?.qteStock || 0)) {
      notifications.show({ title: 'Erreur', message: 'Stock insuffisant', color: 'red' });
    }
  };

  // Retirer du panier
  const retirerDuPanier = (index: number) => {
    setPanier(panier.filter((_, i) => i !== index));
  };

  // Valider le décompte
  const validerDecompte = async () => {
    if (panier.length === 0) {
      notifications.show({ title: 'Erreur', message: 'Aucun produit sélectionné', color: 'red' });
      return;
    }

    setLoadingDecompte(true);
    try {
      const db = await getDb();

      const totalHT = panier.reduce((sum, item) => sum + (item.total / 1.18), 0);
      const totalTTC = panier.reduce((sum, item) => sum + item.total, 0);

      const codeRecu = `DCP-${Date.now()}`;
      const decompteResult = await db.execute(`
        INSERT INTO decomptes (
          idClient, date_decompte, CodeReçu, MontantHT, MontantTTC, statut
        ) VALUES (?, datetime('now'), ?, ?, ?, 'EN_ATTENTE')
      `, [selectedRevendeur?.idRevendeur, codeRecu, totalHT, totalTTC]);

      const idDecompte = decompteResult.lastInsertId;

      for (const item of panier) {
        await db.execute(`
          INSERT INTO decompte_details (
            idDecompte, idProduit, idRevendeur, QteDecompte, PrixUnitaireVente, DateVente
          ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [idDecompte, item.idProduit, selectedRevendeur?.idRevendeur, item.qteDecompte, item.prixVente]);

        await db.execute(`
          UPDATE produits_revendeur 
          SET qte_stock = qte_stock - ?
          WHERE idProduitRevendeur = ?
        `, [item.qteDecompte, item.idProduitRevendeur]);
      }

      notifications.show({
        title: 'Succès',
        message: `Décompte ${codeRecu} enregistré avec succès`,
        color: 'green',
      });

      setDecompteModalOpen(false);
      setPanier([]);
      setQuantites({});
      chargerProduits();

    } catch (error: any) {
      console.error('Erreur:', error);
      notifications.show({ title: 'Erreur', message: error.message, color: 'red' });
    } finally {
      setLoadingDecompte(false);
    }
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const produitsFiltres = useMemo(() => {
    let filtered = [...produits];
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.clientNom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codeProduit?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (codeFactureFiltre) {
      filtered = filtered.filter(p => p.codeFacture?.toLowerCase().includes(codeFactureFiltre.toLowerCase()));
    }
    if (dateDebut) {
      filtered = filtered.filter(p => p.dateEntree >= dateDebut);
    }
    if (dateFin) {
      filtered = filtered.filter(p => p.dateEntree <= dateFin);
    }
    return filtered;
  }, [produits, searchTerm, codeFactureFiltre, dateDebut, dateFin]);

  const stats = {
  totalProduits: produitsFiltres.length,
  totalValeur: produitsFiltres.reduce((sum, p) => sum + ((p.quantiteRestante ?? p.qteStock) * p.prixVente), 0),
  totalBenefice: produitsFiltres.reduce((sum, p) => sum + ((p.quantiteRestante ?? p.qteStock) * (p.prixVente - p.prixAchat)), 0),
  totalCommission: produitsFiltres.reduce((sum, p) => sum + ((p.quantiteRestante ?? p.qteStock) * (p.prixVente - p.prixAchat) * 0.6), 0)
};

  const paginatedProduits = produitsFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSearchTerm('');
    setCodeFactureFiltre('');
    setDateDebut('');
    setDateFin('');
    setCurrentPage(1);
  };

  if (loading && produits.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des commandes revendeurs...</Text>
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
                  <IconTruck size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Commandes Revendeurs</Title>
                  <Text c="gray.3" size="sm">Gestion des stocks et décomptes revendeurs</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={chargerProduits}>
                Actualiser
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={4} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="white" variant="light" size="lg"><IconPackage size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Produits en stock</Text><Text c="white" fw={700} size="xl">{stats.totalProduits}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="green" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Valeur stock</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalValeur)} F</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconCalculator size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Bénéfice potentiel</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalBenefice)} F</Text></div>
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
            <Grid.Col span={3}>
              <TextInput label="CodeFacture" placeholder="Rechercher par code facture..." value={codeFactureFiltre} onChange={(e) => setCodeFactureFiltre(e.target.value)} leftSection={<IconFileInvoice size={16} />} size="md" />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput label="Date1 (Début)" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} size="md" />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput label="Date2 (Fin)" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} size="md" />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput label="Recherche" placeholder="Nom, produit, code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftSection={<IconSearch size={16} />} size="md" />
            </Grid.Col>
          </Grid>
        </Card>

        {/* BOUTONS D'ACTION */}
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Group>
            <Button leftSection={<IconRefresh size={18} />} variant="light" onClick={chargerProduits}>Actualiser</Button>
            <Button leftSection={<IconPlus size={18} />} variant="filled" color="green" onClick={() => setCommandeModalOpened(true)}>Nouvelle commande</Button>
          </Group>
        </Card>

        {/* EN-TÊTE LISTE */}
        <Group justify="space-between" align="center">
          <Title order={3} size="h4">Liste des produits revendeurs</Title>
          <Button variant="subtle" rightSection={<IconDownload size={16} />} size="sm">Exporter</Button>
        </Group>

        {/* TABLEAU PRINCIPAL */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                  <Table.Th w={40}>N°</Table.Th>
                  <Table.Th>Revendeur</Table.Th>
                  <Table.Th>CodeFacture</Table.Th>
                  <Table.Th>Date entrée</Table.Th>
                  <Table.Th>Produit</Table.Th>
                  <Table.Th ta="center">Qté initiale</Table.Th>
                  <Table.Th ta="center">Qté vendue</Table.Th>
                  <Table.Th ta="center">Qté restante</Table.Th>
                  <Table.Th ta="right">Prix achat</Table.Th>
                  <Table.Th ta="right">Prix vente</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedProduits.map((p, index) => {
                  const num = (currentPage - 1) * itemsPerPage + index + 1;
                  const stockRestant = p.quantiteRestante ?? p.qteStock;
                  return (
                    <Table.Tr key={p.idProduitRevendeur}>
                      <Table.Td>{num}</Table.Td>
                      <Table.Td fw={500}>{p.clientNom || p.clientSociete || '-'}</Table.Td>
                      <Table.Td><Text size="xs" fw={500}>{p.codeFacture || '-'}</Text></Table.Td>
                      <Table.Td>{p.dateEntree ? new Date(p.dateEntree).toLocaleDateString('fr-FR') : '-'}</Table.Td>
                      <Table.Td><Text fw={500}>{p.designation}</Text><Text size="xs" c="dimmed">{p.codeProduit}</Text></Table.Td>
                      <Table.Td ta="center">{p.quantiteInitiale || p.qteStock}</Table.Td>
                      <Table.Td ta="center">{p.quantiteVendue || 0}</Table.Td>
                      <Table.Td ta="center">
                        <Badge color={stockRestant <= 0 ? 'red' : stockRestant <= 5 ? 'orange' : 'green'} variant="light">
                          {stockRestant}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">{formatMontant(p.prixAchat)}</Table.Td>
                      <Table.Td ta="right">{formatMontant(p.prixVente)}</Table.Td>
                      <Table.Td ta="center">
                        <Button size="compact-xs" variant="light" color="blue" onClick={() => handleDecompte(p)} disabled={stockRestant === 0}>
                          Décompter
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
          {/* ... */}
        </Card>
      </Stack>

      {/* MODAL DÉCOMPTE */}
      <Modal
        opened={decompteModalOpen}
        onClose={() => { setDecompteModalOpen(false); setPanier([]); setQuantites({}); }}
        size="70%"
        padding="xl"
        radius="lg"
        title="Décompte Revendeur"
      >
        <Box p="lg">
          <Stack gap="lg">
            {/* Informations revendeur */}
            <Card withBorder radius="lg" shadow="sm" p="lg" bg="#f8f9fa">
              <SimpleGrid cols={2}>
                <div>
                  <Text size="xs" c="dimmed">Nom</Text>
                  <Text fw={500}>{selectedRevendeur?.clientNom || selectedRevendeur?.clientSociete}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Contact</Text>
                  <Text>{selectedRevendeur?.clientTel || '-'}</Text>
                </div>
              </SimpleGrid>
            </Card>

            {/* Produits disponibles */}
            <Card withBorder radius="lg" shadow="sm" p="lg">
              <ScrollArea h={300}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produit</Table.Th>
                      <Table.Th ta="center">Stock</Table.Th>
                      <Table.Th ta="right">Prix vente</Table.Th>
                      <Table.Th ta="center">Qté</Table.Th>
                      <Table.Th ta="center">Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {revendeurProduits.map((p) => (
                      <Table.Tr key={p.idProduitRevendeur}>
                        <Table.Td><Text fw={500}>{p.designation}</Text><Text size="xs" c="dimmed">{p.codeProduit}</Text></Table.Td>
                        <Table.Td ta="center"><Badge color={p.qteStock <= 5 ? 'orange' : 'green'}>{p.qteStock}</Badge></Table.Td>
                        <Table.Td ta="right"><Text fw={600}>{formatMontant(p.prixVente)} F</Text></Table.Td>
                        <Table.Td ta="center">
                          <NumberInput
                            size="xs"
                            min={1}
                            max={p.qteStock}
                            value={quantites[p.idProduitRevendeur] || 1}
                            onChange={(val) => setQuantites({ ...quantites, [p.idProduitRevendeur]: Number(val) || 1 })}
                            style={{ width: 80 }}
                          />
                        </Table.Td>
                        <Table.Td ta="center">
                          <Button size="xs" variant="light" color="blue" onClick={() => {
                            const qte = quantites[p.idProduitRevendeur] || 1;
                            ajouterAuPanier(p, qte);
                          }}>Ajouter</Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>

            {/* Panier */}
            {panier.length > 0 && (
              <Card withBorder radius="lg" shadow="sm" p="lg">
                <ScrollArea h={200}>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Produit</Table.Th>
                        <Table.Th ta="center">Qté</Table.Th>
                        <Table.Th ta="right">Total</Table.Th>
                        <Table.Th ta="center"></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {panier.map((item, idx) => (
                        <Table.Tr key={idx}>
                          <Table.Td>{item.designation}</Table.Td>
                          <Table.Td ta="center">
                            <NumberInput size="xs" value={item.qteDecompte} onChange={(val) => updateQuantite(idx, Number(val) || 1)} min={1} max={item.qteDisponible} style={{ width: 80 }} />
                          </Table.Td>
                          <Table.Td ta="right">{formatMontant(item.total)} F</Table.Td>
                          <Table.Td ta="center">
                            <ActionIcon color="red" onClick={() => retirerDuPanier(idx)} variant="subtle"><IconTrash size={16} /></ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
                <Divider my="md" />
                <SimpleGrid cols={2}>
                  <Card withBorder p="sm">
                    <Text size="xs" c="dimmed">Total TTC</Text>
                    <Text fw={700}>{formatMontant(panier.reduce((s, i) => s + i.total, 0))} F</Text>
                  </Card>
                  <Card withBorder p="sm" bg="orange.0">
                    <Text size="xs" c="dimmed">Commission totale</Text>
                    <Text fw={700} c="orange">{formatMontant(panier.reduce((s, i) => s + i.commission, 0))} F</Text>
                  </Card>
                </SimpleGrid>
              </Card>
            )}

            <Group justify="flex-end">
              <Button variant="outline" onClick={() => { setDecompteModalOpen(false); setPanier([]); }}>Annuler</Button>
              <Button color="green" onClick={validerDecompte} loading={loadingDecompte}>Valider décompte</Button>
            </Group>
          </Stack>
        </Box>
      </Modal>

      {/* MODAL NOUVELLE COMMANDE */}
      <FormulaireCommande opened={commandeModalOpened} onClose={() => { setCommandeModalOpened(false); chargerProduits(); }} />
    </>
  );
};

export default ListeCommandesRevendeur;