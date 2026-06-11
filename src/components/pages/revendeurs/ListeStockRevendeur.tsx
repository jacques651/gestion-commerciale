
// src/pages/revendeurs/ListeStockRevendeur.tsx

import { useEffect, useState } from "react";

import {
  Card,
  Table,
  Title,
  Select,
  Stack,
  Text,
  Group,
  Loader,
  Center,
  Badge
} from "@mantine/core";

import {
  IconUser
} from "@tabler/icons-react";

import { clientRepository }
from "../../../database/repositories/clientRepository";

import {
  stockRevendeurRepository
} from "../../../database/repositories/stockRevendeurRepository";


interface Client {
  idClient: number;
  NomComplet: string;
}

export default function ListeStockRevendeur() {

  const [clients, setClients] =
    useState<Client[]>([]);

  const [stock, setStock] =
    useState<any[]>([]);

  const [selectedClient, setSelectedClient] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [valeurStock, setValeurStock] =
    useState(0);

  useEffect(() => {

    loadRevendeurs();

  }, []);

  const loadRevendeurs =
    async () => {

      try {

        const data =
          await clientRepository.getByType(
            "revendeur"
          );

        setClients(data);

      } catch(error) {

        console.error(error);

      } finally {

        setLoading(false);

      }
    };

  const loadStock =
    async (
      idRevendeur: number
    ) => {

      try {

        setLoading(true);

        const data =
          await stockRevendeurRepository
            .getByRevendeur(
              idRevendeur
            );

        setStock(data);

        const valeur =
          await stockRevendeurRepository
            .getValeurStock(
              idRevendeur
            );

        setValeurStock(
          valeur
        );

      } catch(error) {

        console.error(error);

      } finally {

        setLoading(false);

      }
    };

  const clientData =
    clients.map(client => ({
      value:
        client.idClient.toString(),
      label:
        client.NomComplet
    }));

  if (loading && clients.length === 0) {

    return (
      <Center py={100}>
        <Loader />
      </Center>
    );
  }

  return (

    <Stack>

      <Title order={2}>
        Stock Revendeurs
      </Title>

      <Card withBorder>

        <Select
          label="Revendeur"
          placeholder="Choisir un revendeur"
          searchable
          data={clientData}
          value={selectedClient}
          onChange={(value) => {

            setSelectedClient(
              value
            );

            if (value) {

              loadStock(
                Number(value)
              );
            }

          }}
          leftSection={
            <IconUser size={16}/>
          }
        />

      </Card>

      {
        selectedClient && (

          <Card withBorder>

            <Group
              justify="space-between"
              mb="md"
            >

              <Text fw={700}>
                Valeur du stock
              </Text>

              <Badge
                color="green"
                size="lg"
              >
                {
                  valeurStock
                    .toLocaleString()
                } FCFA
              </Badge>

            </Group>

            <Table
              striped
              highlightOnHover
            >

              <Table.Thead>

                <Table.Tr>

                  <Table.Th>
                    Code
                  </Table.Th>

                  <Table.Th>
                    Produit
                  </Table.Th>

                  <Table.Th>
                    Stock
                  </Table.Th>

                  <Table.Th>
                    Prix Achat
                  </Table.Th>

                  <Table.Th>
                    Prix Vente
                  </Table.Th>

                  <Table.Th>
                    Commission
                  </Table.Th>

                  <Table.Th>
                    Valeur
                  </Table.Th>

                </Table.Tr>

              </Table.Thead>

              <Table.Tbody>

                {
                  stock.length === 0
                  ? (

                    <Table.Tr>

                      <Table.Td
                        colSpan={7}
                      >
                        Aucun stock disponible
                      </Table.Td>

                    </Table.Tr>

                  )
                  : (

                    stock.map(item => (

                      <Table.Tr
                        key={
                          item.idStockRevendeur
                        }
                      >

                        <Table.Td>
                          {
                            item.code_produit
                          }
                        </Table.Td>

                        <Table.Td>
                          {
                            item.designation
                          }
                        </Table.Td>

                        <Table.Td>
                          {
                            item.qte_stock
                          }
                        </Table.Td>

                        <Table.Td>
                          {
                            Number(
                              item.prix_achat_base
                            ).toLocaleString()
                          }
                        </Table.Td>

                        <Table.Td>
                          {
                            Number(
                              item.prix_vente_gros
                            ).toLocaleString()
                          }
                        </Table.Td>

                        <Table.Td>
                          {
                            item.commission_pourcentage
                          } %
                        </Table.Td>

                        <Table.Td>
                          {
                            (
                              item.qte_stock *
                              item.prix_achat_base
                            ).toLocaleString()
                          } FCFA
                        </Table.Td>

                      </Table.Tr>

                    ))

                  )
                }

              </Table.Tbody>

            </Table>

          </Card>

        )
      }

    </Stack>

  );
}

