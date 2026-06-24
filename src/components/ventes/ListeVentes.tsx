// src/components/ventes/ListeVentes.tsx
// Remplacer le fichier complet par celui-ci :

import React, { useEffect, useState } from "react";
import {
  Stack, Card, Title, Text, Group, Button, Table, ActionIcon,
  LoadingOverlay, Box, Pagination, Tooltip, Modal, Divider, ThemeIcon,
  SimpleGrid, Select, TextInput, Avatar, Badge, Flex, Paper, Alert,
  Loader, NumberInput,
  Center
} from "@mantine/core";
import {
  IconBuildingStore, IconTrash, IconSearch, IconRefresh,
  IconInfoCircle, IconCalendar, IconCash, IconPlus, IconPrinter, IconEye,
  IconShoppingCart, IconTruck, IconReceipt, IconAlertCircle, IconEdit,
  IconDeviceFloppy, IconX, IconPhone
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import FormulaireVente from "./FormulaireVente";
import ReçuVente from "./ReçuVente";
import { notifications } from "@mantine/notifications";

interface Vente {
  idVente: number;
  code_vente: string;
  idClient: number | null;
  client_nom: string | null;
  client_societe: string | null;
  client_tel: string | null;
  nom_prenom: string | null;
  contact: string | null;
  Tel: string | null;
  date_vente: string;
  montant_ht: number;
  montant_ttc: number;
  montant_total: number;
  type_vente: string;
  statut: string;
}

interface ProduitVente {
  idDetail: number;
  idProduit: number;
  designation: string;
  code_produit: string;
  quantite: number;
  prix_unitaire_ht: number;
  total: number;
}

const ListeVentes: React.FC = () => {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [vueForm, setVueForm] = useState(false);
  const [showReçu, setShowReçu] = useState(false);
  const [selectedVente, setSelectedVente] = useState<Vente | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedVenteDetails, setSelectedVenteDetails] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [venteToDelete, setVenteToDelete] = useState<Vente | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [venteToEdit, setVenteToEdit] = useState<Vente | null>(null);
  const [editProduits, setEditProduits] = useState<ProduitVente[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editQuantites, setEditQuantites] = useState<Record<number, number>>({});
  
  const itemsPerPage = 10;

  const chargerVentes = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT 
          v.*,
          cl.NomComplet as client_nom,
          cl.Societe as client_societe,
          cl.Tel as client_tel
        FROM ventes v
        LEFT JOIN clients cl ON v.idClient = cl.idClient
        ORDER BY v.date_vente DESC
      `);
      
      // Transformer les données pour gérer les cas où le client n'existe pas
      const ventesFormatted = result.map((v: any) => ({
        ...v,
        client_nom: v.client_nom || v.nom_prenom || null,
        client_tel: v.client_tel || v.contact || null
      }));
      
      setVentes(ventesFormatted || []);
    } catch (error) {
      console.error("Erreur chargement ventes:", error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors du chargement des ventes',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerVentes();
  }, []);

  // ✅ Vérifier si une vente peut être supprimée
  const peutSupprimerVente = async (idVente: number): Promise<{ peut: boolean; raison: string }> => {
    const db = await getDb();

    const reglements = await db.select<any[]>(`
      SELECT COUNT(*) as count
      FROM reglements
      WHERE idVente = ?
    `, [idVente]);

    if (reglements[0]?.count > 0) {
      return { peut: false, raison: 'Des règlements ont déjà été effectués sur cette vente' };
    }

    return { peut: true, raison: '' };
  };

  // =====================================================
  // FONCTIONS DE RÉCUPÉRATION DES INFOS CLIENT - CORRIGÉES
  // =====================================================
  
  const getClientDisplay = (vente: any): string => {
    if (!vente) return 'Client inconnu';
    
    // Priorité 1: Nom du client lié
    if (vente.client_nom && typeof vente.client_nom === 'string' && vente.client_nom.trim() !== '') {
      return vente.client_nom;
    }
    // Priorité 2: Nom saisi manuellement
    if (vente.nom_prenom && typeof vente.nom_prenom === 'string' && vente.nom_prenom.trim() !== '') {
      return vente.nom_prenom;
    }
    // Priorité 3: Société
    if (vente.client_societe && typeof vente.client_societe === 'string' && vente.client_societe.trim() !== '') {
      return vente.client_societe;
    }
    // Priorité 4: Contact
    if (vente.contact && typeof vente.contact === 'string' && vente.contact.trim() !== '') {
      return vente.contact;
    }
    return 'Client direct';
  };

  const getClientContact = (vente: any): string => {
    if (!vente) return '-';
    
    if (vente.client_tel && typeof vente.client_tel === 'string' && vente.client_tel.trim() !== '') {
      return vente.client_tel;
    }
    if (vente.contact && typeof vente.contact === 'string' && vente.contact.trim() !== '') {
      return vente.contact;
    }
    if (vente.Tel && typeof vente.Tel === 'string' && vente.Tel.trim() !== '') {
      return vente.Tel;
    }
    return '-';
  };

  const isDirectClient = (vente: any): boolean => {
    if (!vente) return true;
    // Vrai si pas de client_nom ET (pas de nom_prenom OU nom_prenom vide)
    return !vente.client_nom && (!vente.nom_prenom || vente.nom_prenom.trim() === '');
  };

  const handleEditVente = async (vente: Vente) => {
    setEditLoading(true);
    setVenteToEdit(vente);
    try {
      const db = await getDb();
      const produits = await db.select<ProduitVente[]>(`
        SELECT 
          vd.idDetail,
          vd.idProduit,
          vd.quantite,
          vd.prix_unitaire_ht,
          (vd.quantite * vd.prix_unitaire_ht) as total,
          p.designation,
          p.code_produit
        FROM vente_details vd
        LEFT JOIN products p ON vd.idProduit = p.idProduit
        WHERE vd.idVente = ?
      `, [vente.idVente]);
      
      setEditProduits(produits);
      const quantitesInit: Record<number, number> = {};
      produits.forEach(p => {
        quantitesInit[p.idProduit] = p.quantite;
      });
      setEditQuantites(quantitesInit);
      setEditModalOpen(true);
    } catch (error) {
      console.error("Erreur chargement produits:", error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors du chargement des produits',
        color: 'red',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleUpdateQuantite = (idProduit: number, newQuantite: number, stockDisponible: number) => {
    if (newQuantite < 0) return;
    if (newQuantite > stockDisponible) {
      notifications.show({
        title: 'Erreur',
        message: `Stock insuffisant. Maximum: ${stockDisponible}`,
        color: 'red',
      });
      return;
    }
    setEditQuantites(prev => ({ ...prev, [idProduit]: newQuantite }));
  };

  const handleSaveEdit = async () => {
    if (!venteToEdit) return;
    
    setEditLoading(true);
    try {
      const db = await getDb();
      
      let nouveauMontantHT = 0;
      for (const produit of editProduits) {
        const nouvelleQuantite = editQuantites[produit.idProduit] || 0;
        nouveauMontantHT += nouvelleQuantite * produit.prix_unitaire_ht;
      }
      const nouveauMontantTTC = nouveauMontantHT * 1.18;
      
      await db.execute(`
        UPDATE ventes 
        SET montant_ht = ?, montant_ttc = ?
        WHERE idVente = ?
      `, [nouveauMontantHT, nouveauMontantTTC, venteToEdit.idVente]);
      
      for (const produit of editProduits) {
        const ancienneQuantite = produit.quantite;
        const nouvelleQuantite = editQuantites[produit.idProduit] || 0;
        const difference = nouvelleQuantite - ancienneQuantite;
        
        if (difference !== 0) {
          await db.execute(`
            UPDATE vente_details 
            SET quantite = ?
            WHERE idDetail = ?
          `, [nouvelleQuantite, produit.idDetail]);
          
          await db.execute(`
            UPDATE products 
            SET qte_stock = qte_stock - ?
            WHERE idProduit = ?
          `, [difference, produit.idProduit]);
        }
      }
      
      notifications.show({
        title: 'Succès',
        message: 'Vente modifiée avec succès',
        color: 'green',
      });
      
      setEditModalOpen(false);
      setVenteToEdit(null);
      setEditProduits([]);
      setEditQuantites({});
      chargerVentes();
      
    } catch (error) {
      console.error("Erreur modification:", error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la modification',
        color: 'red',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const supprimerVente = async () => {
    if (!venteToDelete) return;

    const { peut, raison } = await peutSupprimerVente(venteToDelete.idVente);
    
    if (!peut) {
      notifications.show({
        title: '❌ Suppression impossible',
        message: raison,
        color: 'red',
        autoClose: 8000
      });
      setDeleteModalOpen(false);
      setVenteToDelete(null);
      return;
    }

    setDeleteLoading(true);
    
    try {
      const db = await getDb();

      const details = await db.select<any[]>(`
        SELECT idProduit, quantite FROM vente_details WHERE idVente = ?
      `, [venteToDelete.idVente]);

      for (const detail of details) {
        await db.execute(`
          UPDATE products 
          SET qte_stock = qte_stock + ? 
          WHERE idProduit = ?
        `, [detail.quantite, detail.idProduit]);
      }

      await db.execute("DELETE FROM vente_details WHERE idVente = ?", [venteToDelete.idVente]);
      await db.execute("DELETE FROM ventes WHERE idVente = ?", [venteToDelete.idVente]);

      notifications.show({
        title: '✅ Succès',
        message: `Vente ${venteToDelete.code_vente} supprimée avec succès - Stock restauré (${details.length} produit(s))`,
        color: 'green',
      });
      
      setDeleteModalOpen(false);
      setVenteToDelete(null);
      chargerVentes();
      
    } catch (error) {
      console.error("Erreur suppression:", error);
      notifications.show({
        title: '❌ Erreur',
        message: 'Erreur lors de la suppression de la vente',
        color: 'red',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePrintReçu = (vente: Vente) => {
    setSelectedVente(vente);
    setShowReçu(true);
  };

  const handleViewDetails = async (vente: Vente) => {
    try {
      const db = await getDb();
      const details = await db.select<any[]>(`
        SELECT 
          vd.*,
          p.designation as produit_nom,
          p.code_produit,
          p.categorie,
          p.qte_stock
        FROM vente_details vd
        LEFT JOIN products p ON vd.idProduit = p.idProduit
        WHERE vd.idVente = ?
      `, [vente.idVente]);

      setSelectedVenteDetails({
        ...vente,
        details
      });
      setDetailsModalOpen(true);
    } catch (error) {
      console.error("Erreur chargement détails:", error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors du chargement des détails',
        color: 'red',
      });
    }
  };

  const ventesFiltrees = ventes.filter(v => {
    if (!v) return false;
    const clientDisplay = getClientDisplay(v);
    const matchRecherche =
      v.code_vente?.toLowerCase().includes(recherche.toLowerCase()) ||
      clientDisplay.toLowerCase().includes(recherche.toLowerCase());

    const matchType = typeFiltre ? v.type_vente === typeFiltre : true;

    return matchRecherche && matchType;
  });

  const totalPages = Math.ceil(ventesFiltrees.length / itemsPerPage);
  const paginatedData = ventesFiltrees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalMontant = ventesFiltrees.reduce((sum, v) => sum + (v.montant_ttc || 0), 0);
  const ventesAujourdhui = ventes.filter(v => v && new Date(v.date_vente).toDateString() === new Date().toDateString()).length;

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString();
  };

  if (vueForm) {
    return <FormulaireVente
      onSuccess={() => {
        setVueForm(false);
        chargerVentes();
      }}
      onCancel={() => setVueForm(false)}
    />;
  }

  if (showReçu && selectedVente) {
    return <ReçuVente
      vente={{
        idVente: selectedVente.idVente,
        nom_prenom: getClientDisplay(selectedVente),
        contact: getClientContact(selectedVente),
        date_vente: selectedVente.date_vente,
        montant_total: selectedVente.montant_ttc || selectedVente.montant_total || 0
      }}
      onClose={() => setShowReçu(false)}
    />;
  }

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" ta="center">
        <LoadingOverlay visible={true} />
        <Loader size="xl" />
        <Text mt="md">Chargement des ventes...</Text>
      </Card>
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
                  <IconShoppingCart size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Ventes au détail</Title>
                  <Text c="gray.3" size="sm">Gérez et suivez toutes vos ventes directes</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button
                variant="light"
                color="white"
                leftSection={<IconInfoCircle size={18} />}
                onClick={() => setInfoModalOpen(true)}
              >
                Instructions
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={4} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconShoppingCart size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Total ventes</Text>
                  <Text c="white" fw={700} size="xl">{ventes.length}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconCash size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Chiffre d'affaires</Text>
                  <Text c="white" fw={700} size="xl">{formatMontant(totalMontant)} FCFA</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconTruck size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Ventes comptoir</Text>
                  <Text c="white" fw={700} size="xl">{ventes.filter(v => v && v.type_vente === 'COMPTOIR').length}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="orange" variant="light" size="lg">
                  <IconCalendar size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Ventes du jour</Text>
                  <Text c="white" fw={700} size="xl">{ventesAujourdhui}</Text>
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
                placeholder="Rechercher par code, client..."
                leftSection={<IconSearch size={16} />}
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }}
                size="md"
                style={{ width: 300 }}
              />
              <Select
                placeholder="Type de vente"
                data={[
                  { value: "", label: "Tous les types" },
                  { value: "COMPTOIR", label: "Comptoir" },
                  { value: "LIVRAISON", label: "Livraison" }
                ]}
                value={typeFiltre}
                onChange={setTypeFiltre}
                size="md"
                style={{ width: 180 }}
                clearable
              />
            </Group>
            <Group>
              <Tooltip label="Actualiser">
                <ActionIcon variant="light" onClick={() => chargerVentes()} size="lg" color="blue">
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setVueForm(true)}
                variant="gradient"
                gradient={{ from: "blue", to: "cyan" }}
                size="md"
              >
                Nouvelle vente
              </Button>
            </Group>
          </Flex>
        </Card>

        {/* Tableau des ventes */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <Paper bg="gray.0" p="md" style={{ borderBottom: '1px solid #e5e7eb' }}>
            <Flex justify="space-between" align="center">
              <Group>
                <IconReceipt size={20} color="#1b365d" />
                <Title order={3} size="h4">Liste des ventes</Title>
                <Badge size="lg" variant="light" color="blue">{ventesFiltrees.length} ventes</Badge>
              </Group>
            </Flex>
          </Paper>

          <Box style={{ overflowX: "auto" }}>
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)'}}>
                  <Table.Th w={60}>N°</Table.Th>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th ta="right">Montant</Table.Th>
                  <Table.Th ta="center" w={200}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedData.map((v, idx) => {
                  // Vérification de sécurité
                  if (!v) {
                    return (
                      <Table.Tr key={`empty-${idx}`}>
                        <Table.Td colSpan={7} ta="center">
                          <Text c="dimmed" size="sm">Données invalides</Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  }
                  
                  const clientDisplay = getClientDisplay(v);
                  const clientContact = getClientContact(v);
                  const isDirect = isDirectClient(v);
                  const hasContact = clientContact && clientContact !== '-';
                  
                  return (
                    <Table.Tr key={v.idVente || idx}>
                      <Table.Td fw={500}>{(currentPage - 1) * itemsPerPage + idx + 1}</Table.Td>
                      <Table.Td>
                        <Text fw={600} size="sm">{v.code_vente || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar size="sm" radius="xl" color={isDirect ? 'gray' : 'blue'}>
                            {(clientDisplay || 'C').charAt(0).toUpperCase()}
                          </Avatar>
                          <Stack gap={0}>
                            <Text fw={500} size="sm">{clientDisplay}</Text>
                            {hasContact && (
                              <Group gap={4}>
                                <IconPhone size={10} color="#868e96" />
                                <Text size="xs" c="dimmed">{clientContact}</Text>
                              </Group>
                            )}
                          </Stack>
                          {isDirect && (
                            <Badge size="xs" color="gray" variant="dot">Direct</Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          size="sm" 
                          color={v.type_vente === 'COMPTOIR' ? 'blue' : 'orange'}
                          variant="light"
                          leftSection={v.type_vente === 'COMPTOIR' ? <IconBuildingStore size={12} /> : <IconTruck size={12} />}
                        >
                          {v.type_vente === 'COMPTOIR' ? 'Comptoir' : 'Livraison'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <IconCalendar size={12} color="#1b365d" />
                          <Text size="sm">{v.date_vente ? new Date(v.date_vente).toLocaleDateString("fr-FR") : '-'}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fw={700} c="blue" size="sm">{formatMontant(v.montant_ttc || v.montant_total || 0)} FCFA</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Group gap={6} justify="center">
                          <Tooltip label="Modifier">
                            <ActionIcon size="md" color="yellow" variant="light" onClick={() => handleEditVente(v)}>
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Voir détails">
                            <ActionIcon size="md" color="blue" variant="light" onClick={() => handleViewDetails(v)}>
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Imprimer reçu">
                            <ActionIcon size="md" color="teal" variant="light" onClick={() => handlePrintReçu(v)}>
                              <IconPrinter size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Supprimer">
                            <ActionIcon size="md" color="red" variant="light" onClick={() => {
                              setVenteToDelete(v);
                              setDeleteModalOpen(true);
                            }}>
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

          {ventesFiltrees.length === 0 && (
            <Flex justify="center" align="center" direction="column" py={60}>
              <IconShoppingCart size={60} color="#ccc" />
              <Text ta="center" c="dimmed" mt="md">Aucune vente trouvée</Text>
              <Button mt="md" variant="light" onClick={() => setVueForm(true)} leftSection={<IconPlus size={16} />}>
                Nouvelle vente
              </Button>
            </Flex>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                size="md"
              />
            </Group>
          )}
        </Card>

        {/* Modal d'édition */}
        <Modal
          opened={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setVenteToEdit(null);
            setEditProduits([]);
            setEditQuantites({});
          }}
          title={`Modifier la vente ${venteToEdit?.code_vente || ''}`}
          size="xl"
          padding="md"
          centered
          styles={{
            header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
            title: { color: 'white', fontWeight: 600 },
            body: { padding: '20px' }
          }}
        >
          {editLoading ? (
            <Center py={50}>
              <Loader size="xl" />
            </Center>
          ) : (
            <Stack gap="md">
              <Card withBorder p="sm" bg="gray.0" radius="md">
                <SimpleGrid cols={2} spacing="md">
                  <div>
                    <Text size="xs" c="dimmed">Client</Text>
                    <Text fw={500}>{getClientDisplay(venteToEdit)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Contact</Text>
                    <Text>{getClientContact(venteToEdit)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Date</Text>
                    <Text>{venteToEdit ? new Date(venteToEdit.date_vente).toLocaleDateString('fr-FR') : '-'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Type</Text>
                    <Badge color={venteToEdit?.type_vente === 'COMPTOIR' ? 'blue' : 'orange'} variant="light">
                      {venteToEdit?.type_vente === 'COMPTOIR' ? 'Comptoir' : 'Livraison'}
                    </Badge>
                  </div>
                </SimpleGrid>
              </Card>

              <Divider label="Produits" labelPosition="center" />

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Désignation</Table.Th>
                    <Table.Th>Prix unitaire</Table.Th>
                    <Table.Th>Quantité</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {editProduits.map((produit) => {
                    const quantite = editQuantites[produit.idProduit] || 0;
                    const total = quantite * produit.prix_unitaire_ht;
                    return (
                      <Table.Tr key={produit.idProduit}>
                        <Table.Td>{produit.code_produit || '-'}</Table.Td>
                        <Table.Td fw={500}>{produit.designation}</Table.Td>
                        <Table.Td>{formatMontant(produit.prix_unitaire_ht)} FCFA</Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={0}
                            value={quantite}
                            onChange={(val) => handleUpdateQuantite(produit.idProduit, Number(val) || 0, 9999)}
                            style={{ width: 100 }}
                          />
                        </Table.Td>
                        <Table.Td fw={600}>{formatMontant(total)} FCFA</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>

              <Divider />

              <Group justify="space-between">
                <Text fw={700} size="lg">
                  Total: {formatMontant(editProduits.reduce((sum, p) => sum + ((editQuantites[p.idProduit] || 0) * p.prix_unitaire_ht), 0) * 1.18)} FCFA
                </Text>
                <Group>
                  <Button variant="outline" onClick={() => setEditModalOpen(false)} leftSection={<IconX size={16} />}>
                    Annuler
                  </Button>
                  <Button onClick={handleSaveEdit} loading={editLoading} color="green" leftSection={<IconDeviceFloppy size={16} />}>
                    Enregistrer
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Modal des détails */}
        <Modal
          opened={detailsModalOpen}
          onClose={() => {
            setDetailsModalOpen(false);
            setSelectedVenteDetails(null);
          }}
          title={`Détails de la vente ${selectedVenteDetails?.code_vente || ''}`}
          size="lg"
          padding="md"
          centered
          styles={{
            header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
            title: { color: 'white', fontWeight: 600 },
            body: { padding: '20px' }
          }}
        >
          {selectedVenteDetails && (
            <Stack gap="md">
              <Card withBorder p="sm" bg="gray.0" radius="md">
                <SimpleGrid cols={2} spacing="md">
                  <div>
                    <Text size="xs" c="dimmed">Client</Text>
                    <Text fw={500}>{getClientDisplay(selectedVenteDetails)}</Text>
                    <Text size="xs" c="dimmed" mt="xs">Contact</Text>
                    <Text>{getClientContact(selectedVenteDetails)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Date</Text>
                    <Text>{new Date(selectedVenteDetails.date_vente).toLocaleDateString('fr-FR')}</Text>
                    <Text size="xs" c="dimmed" mt="xs">Type</Text>
                    <Badge color={selectedVenteDetails.type_vente === 'COMPTOIR' ? 'blue' : 'orange'} variant="light">
                      {selectedVenteDetails.type_vente === 'COMPTOIR' ? 'Comptoir' : 'Livraison'}
                    </Badge>
                  </div>
                </SimpleGrid>
              </Card>

              <Divider label="Produits vendus" labelPosition="center" />

              {selectedVenteDetails.details && selectedVenteDetails.details.length > 0 ? (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Code</Table.Th>
                      <Table.Th>Désignation</Table.Th>
                      <Table.Th>Qté</Table.Th>
                      <Table.Th>Prix unit.</Table.Th>
                      <Table.Th>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedVenteDetails.details.map((detail: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Text size="xs">{detail.code_produit || '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{detail.produit_nom || detail.designation || '-'}</Text>
                        </Table.Td>
                        <Table.Td>{detail.quantite}</Table.Td>
                        <Table.Td>{formatMontant(detail.prix_unitaire_ht)} FCFA</Table.Td>
                        <Table.Td fw={600}>{formatMontant(detail.quantite * detail.prix_unitaire_ht)} FCFA</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text ta="center" c="dimmed" py="md">Aucun détail</Text>
              )}

              <Divider />
              <Group justify="flex-end">
                <Text fw={800} size="lg" c="blue">
                  Total: {formatMontant(selectedVenteDetails.montant_ttc)} FCFA
                </Text>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Modal confirmation suppression */}
        <Modal
          opened={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Supprimer la vente"
          centered
          styles={{
            header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
            title: { color: 'white', fontWeight: 600 },
            body: { padding: '20px' }
          }}
        >
          <Stack>
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="⚠️ Attention !">
              <Text size="sm">
                Êtes-vous sûr de vouloir supprimer cette vente ?
              </Text>
              <Text size="sm" mt="md" c="red">
                <strong>Action irréversible !</strong>
              </Text>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>La vente sera définitivement supprimée</li>
                <li>Les stocks seront automatiquement restaurés</li>
                <li>Les règlements associés seront supprimés</li>
              </ul>
            </Alert>

            <Text size="sm" c="dimmed" ta="center">
              {venteToDelete && `Vente ${venteToDelete.code_vente} du ${new Date(venteToDelete.date_vente).toLocaleDateString('fr-FR')}`}
            </Text>

            <Divider />

            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading}>
                Annuler
              </Button>
              <Button 
                color="red" 
                onClick={supprimerVente} 
                loading={deleteLoading}
                leftSection={<IconTrash size={16} />}
              >
                Supprimer
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal Instructions */}
        <Modal
          opened={infoModalOpen}
          onClose={() => setInfoModalOpen(false)}
          title="📋 Instructions"
          size="md"
          centered
          styles={{
            header: { backgroundColor: "#1b365d", padding: "16px 20px", borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
            title: { color: "white", fontWeight: 600 },
            body: { padding: "20px" }
          }}
        >
          <Stack gap="md">
            <Text size="sm">1. Enregistrez les ventes au comptoir</Text>
            <Text size="sm">2. Modifiez une vente avec le bouton ✏️</Text>
            <Text size="sm">3. Imprimez le reçu pour le client</Text>
            <Text size="sm">4. Le stock est mis à jour automatiquement</Text>
            <Text size="sm">5. Consultez les détails avec l'icône 👁️</Text>
            <Divider />
            <Text size="xs" c="dimmed" ta="center">Version 1.0.0 - Gestion Commerciale Pro</Text>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default ListeVentes;