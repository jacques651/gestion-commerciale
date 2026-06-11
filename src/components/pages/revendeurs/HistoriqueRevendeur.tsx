// src/pages/revendeurs/HistoriqueRevendeur.tsx

import { useState } from "react";

import {
  Card,
  Stack,
  Title,
  Table,
  Select,
  Badge,
  Loader,
  Center
} from "@mantine/core";

import { clientRepository }
from "../../../database/repositories/clientRepository";

import {
  stockRevendeurRepository
} from "../../../database/repositories/stockRevendeurRepository";

import { useEffect } from "react";

export default function HistoriqueRevendeur() {

  const [clients, setClients] =
    useState<any[]>([]);

  const [selected, setSelected] =
    useState<string | null>(null);

  const [mouvements, setMouvements] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {

    loadClients();

  }, []);

  const loadClients =
    async () => {

      const data =
        await clientRepository
          .getByType(
            "revendeur"
          );

      setClients(data);
    };

  const loadHistorique =
    async (
      idRevendeur:number
    ) => {

      try {

        setLoading(true);

        const data =
          await stockRevendeurRepository
            .getHistorique(
              idRevendeur
            );

        setMouvements(data);

      } finally {

        setLoading(false);

      }
    };

  return (

    <Stack>

      <Title order={2}>
        Historique Revendeur
      </Title>

      <Card withBorder>

        <Select
          label="Revendeur"
          searchable
          data={
            clients.map(c => ({
              value:
                c.idClient.toString(),
              label:
                c.NomComplet
            }))
          }
          value={selected}
          onChange={(value)=>{

            setSelected(value);

            if(value){

              loadHistorique(
                Number(value)
              );
            }

          }}
        />

      </Card>

      <Card withBorder>

        {
          loading
          ? (
            <Center py={50}>
              <Loader />
            </Center>
          )
          : (

            <Table
              striped
              highlightOnHover
            >

              <Table.Thead>

                <Table.Tr>

                  <Table.Th>
                    Date
                  </Table.Th>

                  <Table.Th>
                    Produit
                  </Table.Th>

                  <Table.Th>
                    Type
                  </Table.Th>

                  <Table.Th>
                    Quantité
                  </Table.Th>

                  <Table.Th>
                    Référence
                  </Table.Th>

                </Table.Tr>

              </Table.Thead>

              <Table.Tbody>

                {
                  mouvements.map(
                    (m) => (

                    <Table.Tr
                      key={
                        m.idMouvementRevendeur
                      }
                    >

                      <Table.Td>
                        {
                          new Date(
                            m.date_mouvement
                          )
                          .toLocaleDateString()
                        }
                      </Table.Td>

                      <Table.Td>
                        {m.designation}
                      </Table.Td>

                      <Table.Td>

                        <Badge
                          color={
                            m.type_mouvement ===
                            "ENTREE"
                            ? "green"
                            : "red"
                          }
                        >
                          {
                            m.type_mouvement
                          }
                        </Badge>

                      </Table.Td>

                      <Table.Td>
                        {
                          m.qte_mouvement
                        }
                      </Table.Td>

                      <Table.Td>

                        {
                          m.code_commande
                          ||
                          m.code_decompte
                          ||
                          "-"
                        }

                      </Table.Td>

                    </Table.Tr>

                  ))
                }

              </Table.Tbody>

            </Table>

          )
        }

      </Card>

    </Stack>

  );
}