import {
  Paper,
  Table,
  Text,
  Title,
  Group,
  Divider,
  Stack,
  Grid
} from "@mantine/core";

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

  const lignes = details.map(item => {

    const totalAchat =
      item.qteVendue *
      item.prixAchat;

    const totalVente =
      item.qteVendue *
      item.prixVente;

    const benefice =
      totalVente -
      totalAchat;

    const commission =
      benefice *
      item.commissionPourcentage /
      100;

    return {
      ...item,
      totalAchat,
      totalVente,
      benefice,
      commission
    };
  });

  const totalAchat =
    lignes.reduce(
      (s, l) => s + l.totalAchat,
      0
    );

  const totalVente =
    lignes.reduce(
      (s, l) => s + l.totalVente,
      0
    );

  const totalBenefice =
    lignes.reduce(
      (s, l) => s + l.benefice,
      0
    );

  const totalCommission =
    lignes.reduce(
      (s, l) => s + l.commission,
      0
    );

  const montantNet =
    totalVente -
    totalCommission;

  return (
    <Paper
      p="md"
      bg="white"
    >

      {/* Entête société */}

      <Grid mb="lg">

        <Grid.Col span={9}>

          <Stack gap={0}>

            <Title
              order={3}
              ta="center"
            >
              CHRISTOPHE TELECOM
            </Title>

            <Text ta="center">
              Commerce général
            </Text>

            <Text ta="center">
              Vente des accessoires et téléphones
              en gros et détails
            </Text>

            <Text ta="center">
              Saaba route de l'Université USTA
            </Text>

            <Text ta="center">
              Tel : 72101081 / 07537979
            </Text>

          </Stack>

        </Grid.Col>

        <Grid.Col span={3}>

          <div
            style={{
              height: 120,
              border: "1px solid #ddd"
            }}
          >
            LOGO
          </div>

        </Grid.Col>

      </Grid>

      {/* Titre */}

      <Paper
        p="xs"
        mb="md"
        bg="#F2D2BC"
      >
        <Title
          order={2}
          ta="center"
        >
          Reçu de décompte
        </Title>
      </Paper>

      {/* Informations */}

      <Paper
        p="md"
        withBorder
        mb="lg"
      >

        <Grid>

          <Grid.Col span={4}>
            <Text fw={700}>
              Reçu N°
            </Text>
          </Grid.Col>

          <Grid.Col span={8}>
            <Text>
              {numero}
            </Text>
          </Grid.Col>

          <Grid.Col span={4}>
            <Text fw={700}>
              Date
            </Text>
          </Grid.Col>

          <Grid.Col span={8}>
            <Text>
              {date}
            </Text>
          </Grid.Col>

          <Grid.Col span={4}>
            <Text fw={700}>
              Nom du client
            </Text>
          </Grid.Col>

          <Grid.Col span={8}>
            <Text>
              {client}
            </Text>
          </Grid.Col>

        </Grid>

      </Paper>

      {/* Tableau */}

      <Table
        striped
        withTableBorder
        withColumnBorders
      >

        <Table.Thead>

          <Table.Tr>

            <Table.Th>N°</Table.Th>

            <Table.Th>
              Code Facture
            </Table.Th>

            <Table.Th>
              Désignation
            </Table.Th>

            <Table.Th>QT</Table.Th>

            <Table.Th>QV</Table.Th>

            <Table.Th>QR</Table.Th>

            <Table.Th>
              PU Achat
            </Table.Th>

            <Table.Th>
              PU Vente
            </Table.Th>

            <Table.Th>
              Total Achat
            </Table.Th>

            <Table.Th>
              Total Vente
            </Table.Th>

            <Table.Th>
              Bénéfice
            </Table.Th>

            <Table.Th>
              Commission
            </Table.Th>

          </Table.Tr>

        </Table.Thead>

        <Table.Tbody>

          {lignes.map(
            (item, index) => (

              <Table.Tr
                key={item.idProduit}
              >

                <Table.Td>
                  {index + 1}
                </Table.Td>

                <Table.Td>
                  {item.codeFacture}
                </Table.Td>

                <Table.Td>
                  {item.designation}
                </Table.Td>

                <Table.Td>
                  {item.qteInitiale}
                </Table.Td>

                <Table.Td>
                  {item.qteVendue}
                </Table.Td>

                <Table.Td>
                  {item.qteRestante}
                </Table.Td>

                <Table.Td>
                  {item.prixAchat.toLocaleString()}
                </Table.Td>

                <Table.Td>
                  {item.prixVente.toLocaleString()}
                </Table.Td>

                <Table.Td>
                  {item.totalAchat.toLocaleString()}
                </Table.Td>

                <Table.Td>
                  {item.totalVente.toLocaleString()}
                </Table.Td>

                <Table.Td>
                  {item.benefice.toLocaleString()}
                </Table.Td>

                <Table.Td>
                  {item.commission.toLocaleString()}
                </Table.Td>

              </Table.Tr>

            )
          )}

        </Table.Tbody>

      </Table>

      {/* Totaux */}

      <Divider my="md" />

      <Table
        withTableBorder
        withColumnBorders
      >

        <Table.Tbody>

          <Table.Tr>

            <Table.Td
              fw={700}
            >
              Totaux
            </Table.Td>

            <Table.Td />

            <Table.Td />

            <Table.Td />

            <Table.Td />

            <Table.Td />

            <Table.Td />

            <Table.Td />

            <Table.Td fw={700}>
              {totalAchat.toLocaleString()}
            </Table.Td>

            <Table.Td fw={700}>
              {totalVente.toLocaleString()}
            </Table.Td>

            <Table.Td fw={700}>
              {totalBenefice.toLocaleString()}
            </Table.Td>

            <Table.Td fw={700}>
              {totalCommission.toLocaleString()}
            </Table.Td>

          </Table.Tr>

        </Table.Tbody>

      </Table>

      {/* Résumé */}

      <Paper
        mt="lg"
        p="md"
        withBorder
      >

        <Group
          justify="space-between"
        >
          <Text fw={700}>
            Total Achat
          </Text>

          <Text>
            {totalAchat.toLocaleString()}
            FCFA
          </Text>
        </Group>

        <Group
          justify="space-between"
        >
          <Text fw={700}>
            Total Vente
          </Text>

          <Text>
            {totalVente.toLocaleString()}
            FCFA
          </Text>
        </Group>

        <Group
          justify="space-between"
        >
          <Text fw={700}>
            Bénéfice
          </Text>

          <Text>
            {totalBenefice.toLocaleString()}
            FCFA
          </Text>
        </Group>

        <Group
          justify="space-between"
        >
          <Text fw={700}>
            Commission
          </Text>

          <Text>
            {totalCommission.toLocaleString()}
            FCFA
          </Text>
        </Group>

        <Divider my="sm" />

        <Group
          justify="space-between"
        >

          <Text
            fw={900}
            size="xl"
          >
            NET À REVERSER
          </Text>

          <Text
            fw={900}
            size="xl"
          >
            {montantNet.toLocaleString()}
            FCFA
          </Text>

        </Group>

      </Paper>

      {/* Signature */}

      <Group
        justify="flex-end"
        mt={60}
      >
        <Text fw={700}>
          Le responsable
        </Text>
      </Group>

    </Paper>
  );
}