// src/pages/decomptes/DetailDecompte.tsx

import {
  useEffect,
  useState
} from "react";

import {
  useParams,
  useNavigate
} from "react-router-dom";

import {
  Card,
  Stack,
  Title,
  Text,
  Group,
  Table,
  Badge,
  Button,
  Loader,
  Center
} from "@mantine/core";

import {
  IconArrowLeft,
  IconPrinter
} from "@tabler/icons-react";

import {
  useDecomptes
} from "../../hooks/useDecomptes";

export default function DetailDecompte() {

  const { id } =
    useParams();

  const navigate =
    useNavigate();

  const {
    getDecompteById
  } = useDecomptes();

  const [
    decompte,
    setDecompte
  ] = useState<any>(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  useEffect(() => {

    const load =
      async () => {

        try {

          const data =
            await getDecompteById(
              Number(id)
            );

          setDecompte(data);

        } finally {

          setLoading(false);

        }
      };

    load();

  }, [id,
    getDecompteById]);

  if (loading) {

    return (
      <Center py={100}>
        <Loader />
      </Center>
    );
  }

  if (!decompte) {

    return (
      <Center py={100}>
        Décompte introuvable
      </Center>
    );
  }

  return (

    <Stack>

      <Group
        justify="space-between"
      >

        <Button
          variant="subtle"
          leftSection={
            <IconArrowLeft
              size={16}
            />
          }
          onClick={() =>
            navigate(
              "/decomptes"
            )
          }
        >
          Retour
        </Button>

        <Button
          leftSection={
            <IconPrinter
              size={16}
            />
          }
          onClick={() =>
            navigate(
              `/decomptes/${id}/print`
            )
          }
        >
          Imprimer
        </Button>

      </Group>

      <Card withBorder>

        <Title order={3}>
          Décompte
        </Title>

        <Text>
          Code :
          {" "}
          {decompte.code_decompte}
        </Text>

        <Text>
          Revendeur :
          {" "}
          {decompte.NomComplet}
        </Text>

        <Text>
          Société :
          {" "}
          {decompte.Societe || "-"}
        </Text>

        <Text>
          Date :
          {" "}
          {
            new Date(
              decompte.date_decompte
            )
              .toLocaleDateString()
          }
        </Text>

        <Badge
          mt="sm"
          color={
            decompte.statut ===
              "PAYE"
              ? "green"
              : "orange"
          }
        >
          {decompte.statut}
        </Badge>
        {
          decompte.observation && (
            <Text mt="md">
              Observation :
              {" "}
              {decompte.observation}
            </Text>
          )
        }

      </Card>

      <Card withBorder>

        <Table>

          <Table.Thead>

            <Table.Tr>

              <Table.Th>
                Produit
              </Table.Th>

              <Table.Th>
                Qté
              </Table.Th>

              <Table.Th>
                Achat
              </Table.Th>

              <Table.Th>
                Vente
              </Table.Th>

              <Table.Th>
                Commission %
              </Table.Th>

            </Table.Tr>

          </Table.Thead>

          <Table.Tbody>

            {(decompte.details || []).map(
              (detail: any) => (

                <Table.Tr
                  key={
                    detail.idDetailRevendeur
                  }
                >

                  <Table.Td>
                    {detail.designation}
                  </Table.Td>

                  <Table.Td>
                    {detail.qte_decompte}
                  </Table.Td>

                  <Table.Td>
                    {detail.prix_achat}
                  </Table.Td>

                  <Table.Td>
                    {detail.prix_vente}
                  </Table.Td>

                  <Table.Td>
                    {
                      detail
                        .commission_pourcentage
                    }%
                  </Table.Td>

                  <Table.Th>
                    Montant Vente
                  </Table.Th>

                  <Table.Td>
                    {(
                      detail.qte_decompte *
                      detail.prix_vente
                    ).toLocaleString()}
                    FCFA
                  </Table.Td>

                </Table.Tr>

              ))}

          </Table.Tbody>

        </Table>

      </Card>

      <Card withBorder>

        <Text>
          Achat :
          {" "}
          {decompte.montant_achat
            .toLocaleString()}
          FCFA
        </Text>

        <Text>
          Vente :
          {" "}
          {decompte.montant_vente
            .toLocaleString()}
          FCFA
        </Text>

        <Text>
          Bénéfice :
          {" "}
          {decompte.montant_benefice
            .toLocaleString()}
          FCFA
        </Text>

        <Text>
          Commission :
          {" "}
          {decompte.montant_commission
            .toLocaleString()}
          FCFA
        </Text>

        <Title
          order={4}
          mt="md"
        >
          Net à reverser :
          {" "}
          {decompte.montant_net
            .toLocaleString()}
          FCFA
        </Title>

      </Card>

    </Stack>

  );
}