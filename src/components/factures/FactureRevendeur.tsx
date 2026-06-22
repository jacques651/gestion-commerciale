// src/components/factures/FactureRevendeur.tsx
import { Box, Paper, Text, Title, Table, Group, Badge, Divider, Grid, Flex, SimpleGrid } from '@mantine/core';

// ✅ Interface alignée avec la structure réelle
interface FactureRevendeurProps {
  facture: {
    idFactureRevendeur?: number;
    code_facture?: string;
    date_facture?: string;
    idRevendeur?: number;
    idCommande?: number;
    montant_ht?: number;
    montant_ttc?: number;
    commission?: number;
    statut?: string;
    taux_commission?: number;
    // Informations du revendeur
    NomComplet?: string;
    Societe?: string;
    Tel?: string;
    Adresse?: string;
    // Détails de la facture
    details?: Array<{
      idDetailFactureRevendeur?: number;
      idProduit?: number;
      qte_commande?: number;
      prix_achat_base?: number;
      prix_unitaire_vente?: number;
      designation?: string;
      code_produit?: string;
    }>;
    code_commande?: string;
    [key: string]: any;
  };
}

// ✅ Fonction de formatage des montants
const formatMontant = (value: number): string => {
  return (value || 0).toLocaleString('fr-FR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  });
};

// ✅ Fonction de formatage de la date
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};

// ✅ Fonction pour le statut
const getStatutInfo = (statut?: string) => {
  const statusMap: Record<string, { color: string; label: string }> = {
    'payée': { color: 'green', label: 'PAYÉE' },
    'paye': { color: 'green', label: 'PAYÉE' },
    'en_attente': { color: 'orange', label: 'EN ATTENTE' },
    'en cours': { color: 'orange', label: 'EN COURS' },
    'annulee': { color: 'red', label: 'ANNULÉE' },
    'annulée': { color: 'red', label: 'ANNULÉE' },
    'valide': { color: 'blue', label: 'VALIDÉE' },
    'brouillon': { color: 'gray', label: 'BROUILLON' },
  };
  
  const defaultStatus = { color: 'gray', label: 'EN ATTENTE' };
  return statusMap[statut?.toLowerCase() || ''] || defaultStatus;
};

export default function FactureRevendeur({ facture }: FactureRevendeurProps) {
  if (!facture) {
    return (
      <Paper p="xl" withBorder>
        <Text ta="center" c="dimmed">Aucune facture à afficher</Text>
      </Paper>
    );
  }

  const statutInfo = getStatutInfo(facture.statut);
  const tauxCommission = facture.taux_commission || 60;

  // ✅ Calcul du total TTC
  const totalTTC = facture.montant_ttc || facture.total_ttc || 0;

  // ✅ Calcul du bénéfice total
  const totalBenefice = facture.details?.reduce((sum, d) => {
    const qte = d.qte_commande || 0;
    const prixVente = d.prix_unitaire_vente || 0;
    const prixAchat = d.prix_achat_base || 0;
    return sum + ((prixVente - prixAchat) * qte);
  }, 0) || 0;

  // ✅ 🔥 CORRECTION : Commission = 0 si bénéfice négatif
  const commission = totalBenefice > 0 ? (totalBenefice * tauxCommission) / 100 : 0;
  
  // ✅ Net à reverser = Total TTC - Commission (jamais négative)
  const netAReverser = totalTTC - commission;

  // ✅ Récupérer les infos du revendeur
  const revendeurNom = facture.NomComplet || facture.nom_revendeur || 'N/A';
  const revendeurSociete = facture.Societe || facture.societe_revendeur || '';
  const revendeurTel = facture.Tel || facture.telephone_revendeur || '';
  const revendeurAdresse = facture.Adresse || facture.adresse_revendeur || '';

  // ✅ Transformer les détails pour l'affichage
  const lignes = (facture.details || []).map((detail: any, index: number) => {
    const qte = detail.qte_commande || detail.quantite || 0;
    const prixAchat = detail.prix_achat_base || detail.prix_achat || 0;
    const prixVente = detail.prix_unitaire_vente || detail.prix_vente || 0;
    const totalLigne = prixVente * qte;
    const beneficeLigne = (prixVente - prixAchat) * qte;

    return {
      numero: index + 1,
      designation: detail.designation || detail.nom_produit || 'Produit',
      categorie: detail.categorie || detail.categorie_produit || '-',
      unite: detail.unite_base || detail.unite_mesure || 'pièce',
      qte,
      prix_achat: prixAchat,
      prix_vente: prixVente,
      benefice_ligne: beneficeLigne,
      total_vente: totalLigne
    };
  });

  // ✅ Couleurs des montants
  const couleurBenefice = totalBenefice >= 0 ? "green" : "red";
  const couleurCommission = commission > 0 ? "orange" : "gray";
  const couleurNet = netAReverser >= 0 ? "green" : "red";

  return (
    <Paper p="xl" withBorder shadow="sm" mt="md" radius="lg">
      {/* En-tête de la facture */}
      <Box style={{ textAlign: 'center' }} mb="xl">
        <Title 
          order={1} 
          size="h2" 
          c="blue"
          style={{
            fontFamily: 'Georgia, Times New Roman, serif',
            letterSpacing: '2px'
          }}
        >
          FACTURE REVENDEUR
        </Title>
        <Text size="sm" c="dimmed" mt="xs">
          N° {facture.code_facture || 'N/A'}
        </Text>
        {facture.code_commande && (
          <Text size="xs" c="dimmed">
            Commande associée: {facture.code_commande}
          </Text>
        )}
        <Badge 
          color={statutInfo.color} 
          size="lg" 
          variant="filled"
          mt="xs"
          style={{ textTransform: 'uppercase' }}
        >
          {statutInfo.label}
        </Badge>
      </Box>

      <Divider my="md" />

      {/* Informations du revendeur */}
      <Grid grow mb="xl">
        <Grid.Col span={6}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Revendeur</Text>
          <Text fw={700} size="lg">{revendeurNom}</Text>
          {revendeurSociete && (
            <Text size="sm" c="dimmed" mt={2}>{revendeurSociete}</Text>
          )}
          {revendeurAdresse && (
            <Text size="sm" c="dimmed" mt={2}>{revendeurAdresse}</Text>
          )}
          {revendeurTel && (
            <Text size="sm" c="dimmed" mt={2}>📞 {revendeurTel}</Text>
          )}
        </Grid.Col>
        <Grid.Col span={6} style={{ textAlign: 'right' }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Date</Text>
          <Text size="lg" fw={600}>{formatDate(facture.date_facture)}</Text>
          <Text size="xs" c="dimmed" mt="xs" tt="uppercase">Taux Commission</Text>
          <Text size="sm" fw={600} c="orange">{tauxCommission}%</Text>
        </Grid.Col>
      </Grid>

      <Divider my="md" />

      {/* Tableau des produits */}
      <Title order={4} mb="md" fw={600}>Détail des articles</Title>
      
      {lignes.length > 0 ? (
        <Table striped highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr style={{ backgroundColor: '#1b365d' }}>
              <Table.Th c="white" w={40}>#</Table.Th>
              <Table.Th c="white">Désignation</Table.Th>
              <Table.Th c="white">Catégorie</Table.Th>
              <Table.Th c="white" ta="center" w={80}>Unité</Table.Th>
              <Table.Th c="white" ta="center" w={60}>Qté</Table.Th>
              <Table.Th c="white" ta="right" w={90}>P.A (F)</Table.Th>
              <Table.Th c="white" ta="right" w={90}>P.V (F)</Table.Th>
              <Table.Th c="white" ta="right" w={100}>Bénéf (F)</Table.Th>
              <Table.Th c="white" ta="right" w={100}>Total (F)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lignes.map((ligne) => (
              <Table.Tr key={ligne.numero}>
                <Table.Td ta="center">{ligne.numero}</Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>{ligne.designation}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">{ligne.categorie}</Text>
                </Table.Td>
                <Table.Td ta="center">
                  <Badge size="xs" variant="light" color="gray" style={{ fontSize: '12px' }}>
                    {ligne.unite}
                  </Badge>
                </Table.Td>
                <Table.Td ta="center">{ligne.qte}</Table.Td>
                <Table.Td ta="right">{formatMontant(ligne.prix_achat)}</Table.Td>
                <Table.Td ta="right" fw={600}>{formatMontant(ligne.prix_vente)}</Table.Td>
                <Table.Td ta="right" c={ligne.benefice_ligne >= 0 ? "green" : "red"}>
                  {formatMontant(ligne.benefice_ligne)}
                </Table.Td>
                <Table.Td ta="right" fw={700}>{formatMontant(ligne.total_vente)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Paper p="md" withBorder style={{ textAlign: 'center', background: '#f8f9fa' }}>
          <Text c="dimmed">Aucun article dans cette facture</Text>
        </Paper>
      )}

      <Divider my="xl" />

      {/* Récapitulatif - avec couleurs correctes */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="md">
        <Paper p="md" withBorder bg="gray.0">
          <Flex justify="space-between" align="center">
            <Text size="sm" c="dimmed">Total Ventes</Text>
            <Text size="lg" fw={700} c="blue">{formatMontant(totalTTC)} FCFA</Text>
          </Flex>
        </Paper>
        <Paper p="md" withBorder bg={totalBenefice >= 0 ? "green.0" : "red.0"}>
          <Flex justify="space-between" align="center">
            <Text size="sm" fw={600} c={couleurBenefice}>Bénéfice Total</Text>
            <Text size="lg" fw={700} c={couleurBenefice}>
              {formatMontant(totalBenefice)} FCFA
              {totalBenefice < 0 && " ⚠️"}
            </Text>
          </Flex>
        </Paper>
        <Paper p="md" withBorder bg={commission > 0 ? "orange.0" : "gray.0"}>
          <Flex justify="space-between" align="center">
            <Text size="sm" fw={600} c={couleurCommission}>
              Commission ({tauxCommission}%)
              {commission === 0 && " (0 car bénéfice ≤ 0)"}
            </Text>
            <Text size="lg" fw={700} c={couleurCommission}>
              {formatMontant(commission)} FCFA
            </Text>
          </Flex>
        </Paper>
        <Paper p="md" withBorder bg={netAReverser >= 0 ? "teal.0" : "red.0"}>
          <Flex justify="space-between" align="center">
            <Text size="sm" fw={600} c={couleurNet}>Net à reverser</Text>
            <Text size="lg" fw={800} c={couleurNet}>{formatMontant(netAReverser)} FCFA</Text>
          </Flex>
        </Paper>
      </SimpleGrid>

      {/* Net à reverser en grand */}
      <Paper p="md" style={{ 
        backgroundColor: netAReverser >= 0 ? '#e8f5e9' : '#ffebee', 
        borderRadius: '8px', 
        border: `2px solid ${netAReverser >= 0 ? '#4caf50' : '#ef5350'}`
      }}>
        <Flex justify="space-between" align="center">
          <Text fw={700} size="xl" c={netAReverser >= 0 ? "green.8" : "red.8"}>
            NET À REVERSER :
          </Text>
          <Text fw={800} size="xl" c={netAReverser >= 0 ? "green.8" : "red.8"} style={{ fontSize: '2rem' }}>
            {formatMontant(netAReverser)} FCFA
          </Text>
        </Flex>
      </Paper>

      <Divider my="xl" />

      {/* Statut */}
      <Group justify="center" mt="xl">
        <Badge 
          size="xl" 
          color={statutInfo.color}
          variant="filled"
          style={{ 
            padding: '10px 32px', 
            fontSize: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          {statutInfo.label}
        </Badge>
      </Group>

      {/* Pied de page */}
      <Box mt="xl" style={{ textAlign: 'center', borderTop: '2px solid #e9ecef', paddingTop: '20px' }}>
        <Text size="xs" c="dimmed" fw={500}>
          Merci de votre confiance - Gestion Pro
        </Text>
        <Text size="xs" c="dimmed" mt={2}>
          Généré le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} 
          à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text size="xs" c="dimmed" mt={4} fs="italic">
          Tous les montants sont en FCFA
        </Text>
      </Box>
    </Paper>
  );
}