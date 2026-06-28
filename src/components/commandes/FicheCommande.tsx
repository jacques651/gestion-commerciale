// src/components/commandes/FicheCommande.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  Badge,
  LoadingOverlay,
  Box,
  SimpleGrid,
  Divider,
  Table,
  ScrollArea,
  Paper,
  ThemeIcon,
  Flex
} from '@mantine/core';
import {
  IconArrowLeft,
  IconShoppingBag,
  IconUser,
  IconCalendar,
  IconPrinter,
  IconFileInvoice,
  IconReceipt,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { useReactToPrint } from 'react-to-print';
import { notifications } from '@mantine/notifications';

interface CommandeDetail {
  idCommande: number;
  code_commande: string;
  idClient: number;
  client_nom: string;
  client_societe: string | null;
  client_tel: string | null;
  type_commande: string;
  date_commande: string;
  objet: string;
  montant_ht: number;
  montant_ttc: number;
  statut: string;
  code_facture: string | null;
  date_facture: string | null;
  total_paye: number;
  details?: any[];
}

interface FicheCommandeProps {
  commandeId: number;
  onBack: () => void;
}

const FicheCommande: React.FC<FicheCommandeProps> = ({ commandeId, onBack }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [commande, setCommande] = useState<CommandeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingFacture, setGeneratingFacture] = useState(false);

  // ✅ Fonction de formatage de date personnalisée (sans date-fns)
  const formatDate = (dateStr: string): string => {
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

  const formatDateSimple = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const chargerCommande = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      
      // Récupérer la commande
      const result = await db.select<any[]>(`
        SELECT 
          c.*,
          CASE 
            WHEN cl.NomComplet IS NOT NULL AND cl.NomComplet != '' THEN cl.NomComplet
            WHEN cl.Societe IS NOT NULL AND cl.Societe != '' THEN cl.Societe
            ELSE 'Client sans nom'
          END as client_nom,
          cl.Societe as client_societe,
          cl.Tel as client_tel,
          f.code_facture,
          f.date_facture
        FROM commandes c
        JOIN clients cl ON c.idClient = cl.idClient
        LEFT JOIN factures f ON f.idCommande = c.idCommande
        WHERE c.idCommande = ?
      `, [commandeId]);
      
      if (result.length > 0) {
        const commandeData = result[0];
        
        // Récupérer les paiements
        const paiements = await db.select<any[]>(`
          SELECT COALESCE(SUM(montant), 0) as total
          FROM reglements
          WHERE idFacture IN (
            SELECT idFacture FROM factures WHERE idCommande = ?
          )
        `, [commandeId]);
        
        const totalPaye = paiements[0]?.total || 0;
        
        // Récupérer les détails de la commande
        const details = await db.select<any[]>(`
          SELECT 
            cd.idDetail,
            cd.idProduit,
            cd.qte_commande,
            cd.prix_unitaire_vente,
            (cd.qte_commande * cd.prix_unitaire_vente) as total,
            p.code_produit,
            p.designation,
            p.categorie,
            p.unite_base
          FROM commande_details cd
          INNER JOIN products p ON p.idProduit = cd.idProduit
          WHERE cd.idCommande = ?
        `, [commandeId]);
        
        // Calculer le statut
        const montantRestant = commandeData.montant_ttc - totalPaye;
        let statut = 'EN_ATTENTE';
        if (montantRestant <= 0) {
          statut = 'PAYEE';
        } else if (totalPaye > 0) {
          statut = 'PARTIELLE';
        }
        
        setCommande({
          ...commandeData,
          total_paye: totalPaye,
          statut: statut,
          details: details || []
        });
      }
    } catch (error) {
      console.error('Erreur chargement commande:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger la commande',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerCommande();
  }, [commandeId]);

  // ✅ Impression
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Commande_${commande?.code_commande || 'print'}`,
  });

  // ✅ Générer la facture
  const genererFacture = async () => {
    if (!commande) return;
    setGeneratingFacture(true);
    
    try {
      const db = await getDb();
      const codeFacture = `FAC-${Date.now()}`;
      
      await db.execute(`
        UPDATE commandes 
        SET code_facture = ?, date_facture = date('now')
        WHERE idCommande = ?
      `, [codeFacture, commande.idCommande]);
      
      await chargerCommande();
      
      notifications.show({
        title: '✅ Succès',
        message: `Facture ${codeFacture} générée avec succès`,
        color: 'green'
      });
    } catch (error) {
      console.error('Erreur génération facture:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de générer la facture',
        color: 'red'
      });
    } finally {
      setGeneratingFacture(false);
    }
  };

  const getStatutBadge = () => {
    if (!commande) return { label: 'Inconnu', color: 'gray', icon: null };
    switch (commande.statut) {
      case 'PAYEE':
        return { label: 'Payée', color: 'green', icon: <IconCheck size={16} /> };
      case 'PARTIELLE':
        return { label: 'Partiellement payée', color: 'orange', icon: null };
      default:
        return { label: 'Non payée', color: 'red', icon: <IconX size={16} /> };
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'STANDARD' ? 'Standard' : 'Revendeur';
  };

  const getTypeColor = (type: string) => {
    return type === 'STANDARD' ? 'blue' : 'green';
  };

  const getClientDisplayName = () => {
    if (!commande) return '';
    if (commande.client_nom && commande.client_nom !== 'Client sans nom') {
      return commande.client_nom;
    }
    return commande.client_societe || 'Client sans nom';
  };

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement...</Text>
      </Card>
    );
  }

  if (!commande) {
    return (
      <Card withBorder radius="md" p="lg">
        <Text>Commande introuvable</Text>
        <Button mt="md" onClick={onBack}>Retour</Button>
      </Card>
    );
  }

  const statutBadge = getStatutBadge();
  const resteAPayer = commande.montant_ttc - (commande.total_paye || 0);

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* En-tête */}
        <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderBottom: '3px solid #e94560' }}>
          <Flex justify="space-between" align="center" wrap="wrap">
            <Group gap="md">
              <ThemeIcon size={45} radius="md" color="white" variant="light">
                <IconShoppingBag size={28} />
              </ThemeIcon>
              <div>
                <Title order={1} c="white" size="h2">
                  Commande {commande.code_commande}
                </Title>
                <Text c="gray.3" size="sm">{formatDate(commande.date_commande)}</Text>
              </div>
            </Group>
            <Group>
              <Button
                variant="light"
                color="white"
                leftSection={<IconArrowLeft size={16} />}
                onClick={onBack}
              >
                Retour
              </Button>
            </Group>
          </Flex>
        </Paper>

        {/* Zone à imprimer */}
        <div ref={printRef}>
          {/* En-tête pour impression */}
          <div style={{ textAlign: 'center', marginBottom: 20, display: 'none' }}>
            <Title order={2}>Commande {commande.code_commande}</Title>
            <Text>Date: {formatDateSimple(commande.date_commande)}</Text>
            <Text>Client: {getClientDisplayName()}</Text>
          </div>

          {/* Informations client et commande */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Card withBorder radius="md" p="md">
              <Group gap="xs" mb="xs">
                <IconUser size={16} color="#1b365d" />
                <Text fw={600} size="sm">Client</Text>
              </Group>
              <Text size="lg" fw={500}>{getClientDisplayName()}</Text>
              {commande.client_societe && (
                <Text size="sm" c="dimmed">{commande.client_societe}</Text>
              )}
              {commande.client_tel && (
                <Text size="sm" c="dimmed">📞 {commande.client_tel}</Text>
              )}
            </Card>

            <Card withBorder radius="md" p="md">
              <Group gap="xs" mb="xs">
                <IconCalendar size={16} color="#1b365d" />
                <Text fw={600} size="sm">Date</Text>
              </Group>
              <Text size="lg" fw={500}>{formatDateSimple(commande.date_commande)}</Text>
              <Text size="sm" c="dimmed">à {formatDate(commande.date_commande).split(' ')[1] || ''}</Text>
            </Card>

            <Card withBorder radius="md" p="md">
              <Group gap="xs" mb="xs">
                <IconShoppingBag size={16} color="#1b365d" />
                <Text fw={600} size="sm">Type</Text>
              </Group>
              <Badge color={getTypeColor(commande.type_commande)} variant="filled" size="lg">
                {getTypeLabel(commande.type_commande)}
              </Badge>
            </Card>
          </SimpleGrid>

          {/* Récapitulatif financier */}
          <Card withBorder radius="md" p="md" mt="md">
            <Title order={4} mb="md">Récapitulatif financier</Title>
            <Divider mb="md" />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Group justify="space-between">
                <Text size="sm">Montant HT :</Text>
                <Text fw={700}>{formatMontant(commande.montant_ht)} FCFA</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Montant TTC :</Text>
                <Text fw={700} size="lg" c="blue">{formatMontant(commande.montant_ttc)} FCFA</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Total payé :</Text>
                <Text fw={700} c="green">{formatMontant(commande.total_paye || 0)} FCFA</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Reste à payer :</Text>
                <Text fw={700} c="red">{formatMontant(resteAPayer)} FCFA</Text>
              </Group>
            </SimpleGrid>
            
            <Divider my="md" />
            
            <Group justify="space-between">
              <Badge 
                color={statutBadge.color} 
                variant="filled" 
                size="lg"
                leftSection={statutBadge.icon}
              >
                {statutBadge.label}
              </Badge>
              <Text fw={700} size="xl" c="blue">
                Total: {formatMontant(commande.montant_ttc)} FCFA
              </Text>
            </Group>
          </Card>

          {/* Produits commandés */}
          {commande.details && commande.details.length > 0 && (
            <Card withBorder radius="md" p="md" mt="md">
              <Title order={4} mb="md">Produits commandés</Title>
              <Divider mb="md" />
              <ScrollArea h={250}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                      <Table.Th c="white">Code</Table.Th>
                      <Table.Th c="white">Désignation</Table.Th>
                      <Table.Th c="white">Catégorie</Table.Th>
                      <Table.Th c="white" ta="center">Unité</Table.Th>
                      <Table.Th c="white" ta="right">Qté</Table.Th>
                      <Table.Th c="white" ta="right">Prix unit.</Table.Th>
                      <Table.Th c="white" ta="right">Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {commande.details.map((detail: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Text size="xs" fw={500}>{detail.code_produit || '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{detail.designation}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="xs">{detail.categorie || '-'}</Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Text size="xs">{detail.unite_base || 'pc'}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{detail.qte_commande}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{formatMontant(detail.prix_unitaire_vente)}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} c="blue">{formatMontant(detail.total)}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Actions */}
        <Group justify="flex-end">
          <Button 
            onClick={handlePrint} 
            leftSection={<IconPrinter size={16} />}
            variant="light"
            color="teal"
          >
            Imprimer
          </Button>
          {!commande.code_facture && (
            <Button 
              onClick={genererFacture} 
              leftSection={<IconFileInvoice size={16} />} 
              variant="outline"
              loading={generatingFacture}
              disabled={generatingFacture}
            >
              Générer facture
            </Button>
          )}
          {commande.code_facture && (
            <Button
              variant="light"
              color="grape"
              leftSection={<IconReceipt size={16} />}
              onClick={() => {
                notifications.show({
                  title: 'Information',
                  message: `Facture ${commande.code_facture} déjà générée`,
                  color: 'blue'
                });
              }}
            >
              Facture {commande.code_facture}
            </Button>
          )}
        </Group>
      </Stack>
    </Box>
  );
};

export default FicheCommande;