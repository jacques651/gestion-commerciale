// src/components/ventes/ReçuVente.tsx
import React, { useEffect, useState, useRef } from "react";
import { Modal, Stack, Text, Group, Button, Divider, Paper, Table, SimpleGrid, Title, Badge, Center, Loader, Flex, Box } from "@mantine/core";
import { IconPrinter, IconReceipt, IconUser, IconCurrencyFrank } from "@tabler/icons-react";
import { getDb } from "../../database/db";
import { useReactToPrint } from "react-to-print";

interface ProduitVente {
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  total_ht: number;
  total_ttc: number;
}

interface ReçuVenteProps {
  vente: { idVente: number; nom_prenom: string; contact: string; date_vente: string; montant_total: number };
  onClose: () => void;
}

const ReçuVente: React.FC<ReçuVenteProps> = ({ vente, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [produits, setProduits] = useState<ProduitVente[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [numReçu, setNumReçu] = useState<string>("");

  useEffect(() => {
    const chargerDonnees = async () => {
      const db = await getDb();
      
      // Charger les détails de la vente avec HT et TTC
      const details = await db.select<ProduitVente[]>(`
        SELECT 
          p.designation, 
          vd.quantite, 
          vd.prix_unitaire_ht as prix_unitaire_ht,
          (vd.quantite * vd.prix_unitaire_ht) as total_ht,
          (vd.quantite * vd.prix_unitaire_ttc) as total_ttc
        FROM vente_details vd
        JOIN products p ON vd.idProduit = p.idProduit
        WHERE vd.idVente = ?
      `, [vente.idVente]);
      
      // Charger la configuration de l'atelier
      const configData = await db.select<any[]>(`
        SELECT * FROM configuration_atelier WHERE id = 1
      `);
      
      // Générer un numéro de reçu
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      setNumReçu(`RCP-${dateStr}-${vente.idVente}`);
      
      setProduits(details);
      setConfig(configData[0] || {
        nom_atelier: 'MON ATELIER',
        telephone: '',
        adresse: '',
        email: '',
        nif: '',
        message_facture: 'Merci de votre confiance',
        logo_base64: ''
      });
      setLoading(false);
    };
    chargerDonnees();
  }, [vente.idVente]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Reçu_Vente_${vente.idVente}_${new Date().toLocaleDateString()}`,
    onAfterPrint: () => {
      console.log("Impression lancée");
    }
  });

  // Calcul des totaux
  const totalHT = produits.reduce((sum, p) => sum + p.total_ht, 0);
  const totalTTC = produits.reduce((sum, p) => sum + p.total_ttc, 0);
  const tva = totalTTC - totalHT;

  // Formatage du nombre en lettres (simplifié)
  const nombreEnLettres = (nombre: number): string => {
    if (nombre === 0) return 'zéro';
    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const dizaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    
    const convertir = (n: number): string => {
      if (n < 20) return unites[n];
      if (n < 100) {
        const d = Math.floor(n / 10);
        const u = n % 10;
        const dizaine = dizaines[d];
        if (u === 0) return dizaine;
        if (d === 7 || d === 9) return `${dizaine}-${unites[u + 10]}`;
        return `${dizaine}-${unites[u]}`;
      }
      return `${totalTTC.toLocaleString()}`;
    };
    return convertir(totalTTC);
  };

  if (loading) {
    return (
      <Modal opened={true} onClose={onClose} size="md" centered>
        <Center py={50}>
          <Loader size="xl" />
        </Center>
      </Modal>
    );
  }

  return (
    <Modal
      opened={true}
      onClose={onClose}
      size="lg"
      centered
      styles={{
        header: { backgroundColor: "#1b365d", padding: "16px 20px", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" },
        title: { color: "white", fontWeight: 700, fontSize: "1.2rem" },
        body: { padding: 0 }
      }}
      title={
        <Group gap="xs">
          <IconReceipt size={24} color="white" />
          <Text>Reçu de vente</Text>
        </Group>
      }
    >
      <div ref={printRef}>
        <Box style={{ padding: '20px', backgroundColor: 'white' }}>
          {/* En-tête avec logo et infos atelier */}
          <Box style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px solid #1b365d', paddingBottom: 15 }}>
            {config?.logo_base64 && (
              <img 
                src={config.logo_base64} 
                alt="Logo" 
                style={{ height: '60px', marginBottom: '10px', objectFit: 'contain' }}
              />
            )}
            <Title order={2} style={{ color: '#1b365d', margin: 0, fontSize: '20px' }}>
              {config?.nom_atelier || 'MON ATELIER'}
            </Title>
            <Text size="xs" c="dimmed" mt={4}>
              {config?.adresse || ''}
            </Text>
            <Text size="xs" c="dimmed">
              Tel: {config?.telephone || ''}
            </Text>
            {config?.email && (
              <Text size="xs" c="dimmed">
                Email: {config?.email}
              </Text>
            )}
            {config?.nif && (
              <Text size="xs" c="dimmed">
                NIF: {config?.nif}
              </Text>
            )}
          </Box>

          {/* Titre du document */}
          <Box style={{ textAlign: 'center', marginBottom: 20 }}>
            <Title order={3} style={{ backgroundColor: '#f2d2bc', display: 'inline-block', padding: '8px 20px', borderRadius: '8px' }}>
              REÇU DE VENTE
            </Title>
          </Box>

          {/* Numéro de reçu et date */}
          <SimpleGrid cols={2} spacing="md" mb="md">
            <Paper p="xs" withBorder>
              <Text size="xs" c="dimmed">N° Reçu</Text>
              <Text fw={700}>{numReçu}</Text>
            </Paper>
            <Paper p="xs" withBorder>
              <Text size="xs" c="dimmed">Date</Text>
              <Text fw={500}>{new Date(vente.date_vente).toLocaleDateString("fr-FR")}</Text>
              <Text size="xs" c="dimmed">{new Date(vente.date_vente).toLocaleTimeString("fr-FR")}</Text>
            </Paper>
          </SimpleGrid>

          {/* Informations client */}
          <Paper p="md" withBorder mb="md" style={{ backgroundColor: '#f8f9fa' }}>
            <Group gap="xs" mb="xs">
              <IconUser size={16} color="#1b365d" />
              <Text fw={600}>Informations client</Text>
            </Group>
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="xs" c="dimmed">Nom / Prénom</Text>
                <Text fw={500}>{vente.nom_prenom || "Client anonyme"}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Contact</Text>
                <Text>{vente.contact || "-"}</Text>
              </div>
            </SimpleGrid>
          </Paper>

          {/* Tableau des produits */}
          <Box mb="md">
            <Text fw={600} mb="xs">Articles commandés</Text>
            <Table striped highlightOnHover withColumnBorders>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                  <Table.Th c="white">Désignation</Table.Th>
                  <Table.Th c="white" ta="center">Qté</Table.Th>
                  <Table.Th c="white" ta="right">Prix HT</Table.Th>
                  <Table.Th c="white" ta="right">Total HT</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {produits.map((p, i) => (
                  <Table.Tr key={i}>
                    <Table.Td fw={500}>{p.designation}</Table.Td>
                    <Table.Td ta="center">
                      <Badge variant="light" size="sm">{p.quantite}</Badge>
                    </Table.Td>
                    <Table.Td ta="right">{p.prix_unitaire_ht.toLocaleString()} FCFA</Table.Td>
                    <Table.Td ta="right" fw={600}>{p.total_ht.toLocaleString()} FCFA</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>

          {/* Récapitulatif des totaux */}
          <Paper p="md" withBorder mb="md">
            <Stack gap="sm">
              <Flex justify="space-between" align="center">
                <Text fw={600}>Total HT :</Text>
                <Text fw={700} size="lg">{totalHT.toLocaleString()} FCFA</Text>
              </Flex>
              <Flex justify="space-between" align="center">
                <Text fw={600} c="orange">TVA (18%) :</Text>
                <Text fw={600} c="orange">{tva.toLocaleString()} FCFA</Text>
              </Flex>
              <Divider />
              <Flex justify="space-between" align="center" style={{ backgroundColor: '#e8f5e9', padding: '10px', borderRadius: '8px' }}>
                <Group gap="xs">
                  <IconCurrencyFrank size={24} color="#2e7d32" />
                  <Text fw={700} size="lg" c="green.8">Total TTC :</Text>
                </Group>
                <Text fw={800} size="xl" c="green.8">
                  {totalTTC.toLocaleString()} FCFA
                </Text>
              </Flex>
            </Stack>
          </Paper>

          {/* Montant en lettres */}
          <Paper p="md" withBorder mb="md" style={{ backgroundColor: '#f8f9fa' }}>
            <Text size="sm" fw={500}>
              Arrêté le présent reçu à la somme de : {nombreEnLettres(totalTTC)} ({totalTTC.toLocaleString()}) Francs CFA
            </Text>
          </Paper>

          {/* Message de remerciement */}
          <Box style={{ textAlign: 'center', marginTop: 20, paddingTop: 15, borderTop: '1px solid #e9ecef' }}>
            <Text size="sm" fw={500} c="dimmed">
              {config?.message_facture || 'Merci de votre visite !'}
            </Text>
            <Text size="xs" c="dimmed" mt={8}>
              {config?.nom_atelier} - Tel: {config?.telephone}
            </Text>
            <Text size="xs" c="dimmed">
              {config?.adresse}
            </Text>
          </Box>
        </Box>
      </div>

      <Divider />
      
      {/* Boutons */}
      <Group justify="flex-end" p="md" className="no-print">
        <Button variant="light" onClick={onClose}>
          Fermer
        </Button>
        <Button onClick={handlePrint} leftSection={<IconPrinter size={16} />} color="blue">
          Imprimer
        </Button>
      </Group>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            padding: 0;
            margin: 0;
          }
          .mantine-Modal-root {
            display: none !important;
          }
        }
      `}</style>
    </Modal>
  );
};

export default ReçuVente;