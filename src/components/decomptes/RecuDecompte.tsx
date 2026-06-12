// src/components/decomptes/RecuDecompte.tsx
import {
  Paper,
  Table,
  Text,
  Title,
  Group,
  Divider,
  Stack,
  Grid,
  Box,
  Image,
  LoadingOverlay
} from "@mantine/core";
import { useAtelierConfig } from "../../hooks/useAtelierConfig";

export interface RecuDecompteDetail {
  idProduit: number;
  codeFacture: string;
  designation: string;
  qteInitiale: number;
  qteVendue: number;
  qteRestante: number;
  prixAchat: number;
  prixVente: number;
  commissionPourcentage: number;
}

interface RecuDecompteProps {
  numero: string;
  date: string;
  client: string;
  details: RecuDecompteDetail[];
}

export default function RecuDecompte({
  numero,
  date,
  client,
  details
}: RecuDecompteProps) {

  const { config: atelier, loading: atelierLoading } = useAtelierConfig();

  // Valeurs par défaut de l'atelier
  const atelierData = atelier || {
    nom_atelier: 'CHRISTOPHE TELECOM',
    telephone: '07537979',
    adresse: 'Saaba à côté de l\'Université Saint Thomas d\'Acquin',
    email: 'contact@christophetelecom.ci',
    message_facture: 'Merci de votre confiance',
    logo_base64: '',
    nif: ''
  };

  // Vérifier que details existe et est un tableau
  const safeDetails = Array.isArray(details) ? details : [];

const lignes = safeDetails.map(item => {
  // Valeurs par défaut pour éviter les undefined
  const qteVendue = item?.qteVendue || 0;
  const prixAchat = item?.prixAchat || 0;
  const prixVente = item?.prixVente || 0;
  const commissionPourcentage = item?.commissionPourcentage || 0;
  
  const totalAchat = qteVendue * prixAchat;
  const totalVente = qteVendue * prixVente;
  const benefice = totalVente - totalAchat;
  const commission = (benefice * commissionPourcentage) / 100;

  return {
    ...item,
    qteInitiale: item?.qteInitiale || qteVendue,
    qteVendue: qteVendue,
    qteRestante: item?.qteRestante || 0,
    prixAchat: prixAchat,
    prixVente: prixVente,
    commissionPourcentage: commissionPourcentage,
    totalAchat,
    totalVente,
    benefice,
    commission
  };
});

  const totalAchat = lignes.reduce((s, l) => s + (l.totalAchat || 0), 0);
  const totalVente = lignes.reduce((s, l) => s + (l.totalVente || 0), 0);
  const totalBenefice = lignes.reduce((s, l) => s + (l.benefice || 0), 0);
  const totalCommission = lignes.reduce((s, l) => s + (l.commission || 0), 0);
  const montantNet = totalVente - totalCommission;

  const formatNombre = (value: number): string => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toLocaleString('fr-FR');
  };

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
      return `${formatNombre(nombre)}`;
    };
    return convertir(nombre);
  };

  if (atelierLoading) {
    return (
      <Paper p="md" bg="white" shadow="sm" radius="md" style={{ position: 'relative', minHeight: 300 }}>
        <LoadingOverlay visible={true} />
        <Text ta="center">Chargement...</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" bg="white" shadow="sm" radius="md">

      {/* Entête société dynamique */}
      <Grid mb="lg">
        <Grid.Col span={9}>
          <Stack gap={2}>
            {atelierData.logo_base64 && (
              <Image 
                src={atelierData.logo_base64} 
                w={80} 
                h={80} 
                fit="contain" 
                mx="auto"
                mb={8}
              />
            )}
            <Title order={2} ta="center" fw={800} style={{ fontSize: '22px', letterSpacing: '1px' }}>
              {atelierData.nom_atelier}
            </Title>
            <Text ta="center" size="sm" fw={500}>Commerce général</Text>
            <Text ta="center" size="sm">Vente des accessoires et téléphones en gros et détails</Text>
            <Text ta="center" size="sm">{atelierData.adresse}</Text>
            <Text ta="center" size="sm">Tel: {atelierData.telephone}</Text>
            {atelierData.email && <Text ta="center" size="sm">Email: {atelierData.email}</Text>}
            {atelierData.nif && <Text ta="center" size="sm">NIF: {atelierData.nif}</Text>}
          </Stack>
        </Grid.Col>

        <Grid.Col span={3}>
          <Box style={{ height: 100, border: "1px solid #ddd", borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' }}>
            {atelierData.logo_base64 ? (
              <Image src={atelierData.logo_base64} w={80} h={80} fit="contain" />
            ) : (
              <Text size="xs" c="dimmed">LOGO</Text>
            )}
          </Box>
        </Grid.Col>
      </Grid>

      {/* Titre */}
      <Paper p="xs" mb="md" bg="#F2D2BC" radius="md">
        <Title order={2} ta="center" size="h3" fw={700}>
          Reçu de décompte
        </Title>
      </Paper>

      {/* Informations */}
      <Paper p="md" withBorder mb="lg" radius="md">
        <Grid>
          <Grid.Col span={3}>
            <Text fw={700}>Reçu N° :</Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text>{numero || '-'}</Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text fw={700}>Date :</Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text>{date || '-'}</Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text fw={700}>NomComplet :</Text>
          </Grid.Col>
          <Grid.Col span={9}>
            <Text fw={600}>{client || '-'}</Text>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Tableau */}
      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr style={{ backgroundColor: '#1b365d' }}>
            <Table.Th c="white" ta="center" w={50}>N°</Table.Th>
            <Table.Th c="white">CodeFacture</Table.Th>
            <Table.Th c="white">Designation</Table.Th>
            <Table.Th c="white" ta="center" w={60}>QI</Table.Th>
            <Table.Th c="white" ta="center" w={60}>QV</Table.Th>
            <Table.Th c="white" ta="center" w={60}>QCumulé</Table.Th>
            <Table.Th c="white" ta="center" w={60}>QR</Table.Th>
            <Table.Th c="white" ta="right" w={100}>PU Achat</Table.Th>
            <Table.Th c="white" ta="right" w={100}>PU Vente</Table.Th>
            <Table.Th c="white" ta="right" w={120}>Total Achat</Table.Th>
            <Table.Th c="white" ta="right" w={120}>Total Vente</Table.Th>
            <Table.Th c="white" ta="right" w={100}>Bénéfice</Table.Th>
            <Table.Th c="white" ta="right" w={120}>Commission</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lignes.map((item, index) => (
            <Table.Tr key={item.idProduit || index}>
              <Table.Td ta="center">{index + 1}</Table.Td>
              <Table.Td>{item.codeFacture || '-'}</Table.Td>
              <Table.Td fw={500}>{item.designation || '-'}</Table.Td>
              <Table.Td ta="center">{formatNombre(item.qteInitiale)}</Table.Td>
              <Table.Td ta="center">{formatNombre(item.qteVendue)}</Table.Td>
              <Table.Td ta="center">{formatNombre(item.qteVendue)}</Table.Td>
              <Table.Td ta="center">{formatNombre(item.qteRestante)}</Table.Td>
              <Table.Td ta="right">{formatNombre(item.prixAchat)}</Table.Td>
              <Table.Td ta="right">{formatNombre(item.prixVente)}</Table.Td>
              <Table.Td ta="right">{formatNombre(item.totalAchat)}</Table.Td>
              <Table.Td ta="right">{formatNombre(item.totalVente)}</Table.Td>
              <Table.Td ta="right">{formatNombre(item.benefice)}</Table.Td>
              <Table.Td ta="right">{formatNombre(item.commission)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Totaux */}
      <Divider my="md" />
      <Table withTableBorder withColumnBorders>
        <Table.Tbody>
          <Table.Tr style={{ backgroundColor: '#f8f9fa' }}>
            <Table.Td fw={700} ta="right" colSpan={9}>Totaux :</Table.Td>
            <Table.Td ta="right" fw={700}>{formatNombre(totalAchat)}</Table.Td>
            <Table.Td ta="right" fw={700}>{formatNombre(totalVente)}</Table.Td>
            <Table.Td ta="right" fw={700}>{formatNombre(totalBenefice)}</Table.Td>
            <Table.Td ta="right" fw={700}>{formatNombre(totalCommission)}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>

      {/* Montant en lettres */}
      <Paper mt="lg" p="md" withBorder radius="md" style={{ backgroundColor: '#f8f9fa' }}>
        <Text size="sm" fw={500}>
          Arrêté le présent reçu à la somme de : {nombreEnLettres(montantNet)} ({formatNombre(montantNet)}) Francs CFA
        </Text>
      </Paper>

      {/* Signature */}
      <Group justify="flex-end" mt={60}>
        <Stack gap={0} align="center">
          <Text fw={700}>Le responsable</Text>
          <Text size="xs" c="dimmed" mt={30}>Signature et cachet</Text>
        </Stack>
      </Group>

      {/* Footer message */}
      {atelierData.message_facture && (
        <Text size="xs" c="dimmed" ta="center" mt={30}>
          {atelierData.message_facture}
        </Text>
      )}
    </Paper>
  );
}