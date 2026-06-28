// src/components/ventes/ReçuVente.tsx
import React, { useEffect, useState, useRef } from "react";
import { Modal, Text, Group, Button, Divider, Paper, Table, SimpleGrid, Badge, Center, Loader, Flex, Box } from "@mantine/core";
import { IconPrinter, IconReceipt, IconCurrencyFrank } from "@tabler/icons-react";
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

      const configData = await db.select<any[]>(`
        SELECT * FROM configuration_atelier WHERE id = 1
      `);

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
  });

  const totalHT = produits.reduce((sum, p) => sum + p.total_ht, 0);
  const totalTTC = produits.reduce((sum, p) => sum + p.total_ttc, 0);
  const tva = totalTTC - totalHT;

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
      if (n < 1000) {
        const c = Math.floor(n / 100);
        const r = n % 100;
        let result = c === 1 ? 'cent' : unites[c] + ' cents';
        if (r > 0) result += ' ' + convertir(r);
        return result;
      }
      if (n < 1000000) {
        const m = Math.floor(n / 1000);
        const r = n % 1000;
        let result = m === 1 ? 'mille' : convertir(m) + ' mille';
        if (r > 0) result += ' ' + convertir(r);
        return result;
      }
      return n.toLocaleString();
    };
    return convertir(nombre);
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

  const montantEnLettres = nombreEnLettres(totalTTC);
  const montantEnLettresMaj = montantEnLettres.charAt(0).toUpperCase() + montantEnLettres.slice(1);

  const printStyles = `
    @media print {
      .no-print { display: none !important; }

      @page {
        size: A4 portrait;
        margin: 12mm 14mm;
      }

      body, html {
        margin: 0 !important;
        padding: 0 !important;
      }

      .recu-body {
        padding: 10px !important;
        font-size: 11px !important;
        line-height: 1.4 !important;
      }

      .recu-body * {
        font-size: 11px !important;
        line-height: 1.4 !important;
      }

      .recu-body table {
        font-size: 10px !important;
        border-collapse: collapse !important;
      }

      .recu-body table th,
      .recu-body table td {
        padding: 5px 6px !important;
        font-size: 10px !important;
      }

      .recu-body [class*="mantine-Paper"] {
        padding: 5px 8px !important;
        margin-bottom: 4px !important;
      }

      .recu-body [class*="mantine-SimpleGrid"] {
        gap: 6px !important;
        margin-bottom: 6px !important;
      }

      .recu-body [class*="mantine-Divider"] {
        margin: 5px 0 !important;
      }

      .recu-body [class*="mantine-Badge"] {
        font-size: 10px !important;
        padding: 1px 5px !important;
        height: auto !important;
      }

      .recu-body [class*="mantine-Text"] {
        line-height: 1.4 !important;
      }
    }
  `;

  return (
    <Modal
      opened={true}
      onClose={onClose}
      size="lg"
      centered
      styles={{
        header: { backgroundColor: "#1a1a2e", padding: "10px 16px", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" },
        title: { color: "white", fontWeight: 700, fontSize: "1rem" },
        body: { padding: 0 }
      }}
      title={
        <Group gap="xs">
          <IconReceipt size={20} color="white" />
          <Text>Reçu de vente</Text>
        </Group>
      }
    >
      <div ref={printRef}>
        <Box className="recu-body" style={{ padding: '12px', backgroundColor: 'white', fontSize: '11px' }}>

          {/* En-tête */}
          <Flex justify="space-between" align="center" wrap="wrap" gap={4} style={{ borderBottom: '2px solid #1b365d', paddingBottom: 6, marginBottom: 8 }}>
            <Flex align="center" gap={6}>
              {config?.logo_base64 && (
                <img src={config.logo_base64} alt="Logo" style={{ height: '32px', objectFit: 'contain' }} />
              )}
              <Box>
                <Text fw={700} size="sm" c="#1b365d">{config?.nom_atelier || 'MON ATELIER'}</Text>
                <Text size="xs" c="dimmed" lh={1.2}>{config?.telephone}</Text>
              </Box>
            </Flex>
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" fw={600}>N° {numReçu}</Text>
              <Text size="xs" c="dimmed">{new Date(vente.date_vente).toLocaleDateString("fr-FR")}</Text>
            </Box>
          </Flex>

          {/* Titre */}
          <Text ta="center" fw={700} size="sm" style={{ backgroundColor: '#f2d2bc', padding: '3px', borderRadius: '3px', marginBottom: 6 }}>
            REÇU DE VENTE
          </Text>

          {/* Infos client */}
          <SimpleGrid cols={3} spacing="xs" mb={4}>
            <Paper p={4} withBorder>
              <Text size="xs" c="dimmed" lh={1}>Client</Text>
              <Text size="xs" fw={500}>{vente.nom_prenom || "Client anonyme"}</Text>
            </Paper>
            <Paper p={4} withBorder>
              <Text size="xs" c="dimmed" lh={1}>Contact</Text>
              <Text size="xs">{vente.contact || "-"}</Text>
            </Paper>
            <Paper p={4} withBorder>
              <Text size="xs" c="dimmed" lh={1}>Heure</Text>
              <Text size="xs">{new Date(vente.date_vente).toLocaleTimeString("fr-FR")}</Text>
            </Paper>
          </SimpleGrid>

          <Divider my={4} />

          {/* Tableau */}
          <Table withColumnBorders style={{ fontSize: '9px', marginBottom: 6 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                <Table.Th c="white" w="40%">Désignation</Table.Th>
                <Table.Th c="white" ta="center" w="15%">Qté</Table.Th>
                <Table.Th c="white" ta="right" w="22%">Prix HT</Table.Th>
                <Table.Th c="white" ta="right" w="23%">Total HT</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {produits.map((p, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Text size="xs" fw={500}>{p.designation}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge variant="light" size="xs">{p.quantite}</Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="xs">{p.prix_unitaire_ht.toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="xs" fw={600}>{p.total_ht.toLocaleString()}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {/* Totaux */}
          <SimpleGrid cols={3} spacing={4} mb={4}>
            <Paper p={4} withBorder>
              <Flex justify="space-between" align="center">
                <Text size="xs" fw={600}>Total HT</Text>
                <Text size="xs" fw={600}>{totalHT.toLocaleString()} F</Text>
              </Flex>
            </Paper>
            <Paper p={4} withBorder style={{ backgroundColor: '#fff3e0' }}>
              <Flex justify="space-between" align="center">
                <Text size="xs" fw={600} c="orange">TVA (18%)</Text>
                <Text size="xs" fw={600} c="orange">{tva.toLocaleString()} F</Text>
              </Flex>
            </Paper>
            <Paper p={4} withBorder style={{ backgroundColor: '#e8f5e9', borderColor: '#4caf50' }}>
              <Flex justify="space-between" align="center">
                <Group gap={4}>
                  <IconCurrencyFrank size={14} color="#2e7d32" />
                  <Text size="xs" fw={700} c="green.8">Total TTC</Text>
                </Group>
                <Text size="sm" fw={800} c="green.8">{totalTTC.toLocaleString()} F</Text>
              </Flex>
            </Paper>
          </SimpleGrid>

          {/* Montant en lettres */}
          <Paper p={4} withBorder style={{ backgroundColor: '#f8f9fa', marginBottom: 4 }}>
            <Text size="xs" fw={500} ta="center" lh={1.3}>
              Arrêté le présent reçu à la somme de : <strong>{montantEnLettresMaj}</strong> ({totalTTC.toLocaleString()}) FCFA
            </Text>
          </Paper>

          {/* Signature */}
          <Flex justify="space-between" mt={6}>
            <Box>
              <Text size="xs" fw={600}>Fait à <u>....................</u> le {new Date().toLocaleDateString('fr-FR')}</Text>
            </Box>
            <Box>
              <Text fw={600} size="xs" ta="center">Signature &amp; cachet</Text>
              <div style={{ borderTop: '1px solid #000', width: '100px', margin: '2px auto 0' }}></div>
            </Box>
          </Flex>

          {/* Pied de page */}
          <Flex justify="space-between" mt={6} pt={4} style={{ borderTop: '1px solid #e8ecf1' }}>
            <Text size="xs" fs="italic" c="dimmed">{config?.message_facture || 'Merci de votre confiance'}</Text>
            <Text size="xs" c="dimmed">Page 1/1</Text>
          </Flex>

          {/* Infos atelier */}
          <Flex justify="space-between" mt={2} style={{ fontSize: '8px', color: '#aaa' }}>
            <Text>{config?.adresse}</Text>
            <Text>{config?.nif && `NIF: ${config.nif}`}</Text>
            {config?.email && <Text>{config.email}</Text>}
          </Flex>
        </Box>
      </div>

      <Divider />

      {/* Boutons */}
      <Group justify="flex-end" p="xs" className="no-print" gap="xs">
        <Button size="compact-xs" variant="subtle" onClick={onClose}>Fermer</Button>
        <Button size="compact-xs" onClick={handlePrint} leftSection={<IconPrinter size={14} />} color="blue">
          Imprimer
        </Button>
      </Group>

      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
    </Modal>
  );
};

export default ReçuVente;