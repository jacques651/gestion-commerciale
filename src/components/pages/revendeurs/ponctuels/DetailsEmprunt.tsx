// src/components/pages/revendeurs/ponctuels/DetailsEmprunt.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack, Card, Text, Group, Table, Badge, Button,
  NumberInput, Modal, TextInput, Divider, Alert,
  LoadingOverlay, ScrollArea,
  SimpleGrid
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRotate, IconShoppingCart, IconRefresh } from '@tabler/icons-react';
import { temporaryResellerRepository } from '../../../../database/repositories/temporaryResellerRepository';


interface DetailsEmpruntProps {
  emprunt: any;
  onUpdate: () => void;
}

export const DetailsEmprunt: React.FC<DetailsEmpruntProps> = ({ emprunt, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any[]>([]);
  const [retourModal, setRetourModal] = useState(false);
  const [venteModal, setVenteModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [quantiteRetour, setQuantiteRetour] = useState(1);
  const [quantiteVente, setQuantiteVente] = useState(1);
  const [prixVente, setPrixVente] = useState(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [emprunt]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const data = await temporaryResellerRepository.getBorrowDetails(emprunt.idEmprunt);
      setDetails(data);
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les détails',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetour = async () => {
    if (!selectedDetail || quantiteRetour <= 0) return;

    const quantiteRestante = selectedDetail.quantite_empruntee - 
                            selectedDetail.quantite_retournee - 
                            selectedDetail.quantite_vendue;

    if (quantiteRetour > quantiteRestante) {
      notifications.show({
        title: 'Erreur',
        message: `Quantité restante: ${quantiteRestante}`,
        color: 'red'
      });
      return;
    }

    setUpdating(true);
    try {
      await temporaryResellerRepository.retournerProduits(
        emprunt.idEmprunt,
        [{
          idEmpruntDetail: selectedDetail.idEmpruntDetail,
          quantite: quantiteRetour,
          prixVente: selectedDetail.prix_vente_unitaire
        }]
      );

      notifications.show({
        title: '✅ Succès',
        message: `${quantiteRetour} unité(s) retournée(s) avec succès`,
        color: 'green'
      });

      setRetourModal(false);
      setSelectedDetail(null);
      setQuantiteRetour(1);
      loadDetails();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: '❌ Erreur',
        message: error.message || 'Erreur lors du retour',
        color: 'red'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleVente = async () => {
    if (!selectedDetail || quantiteVente <= 0 || prixVente <= 0) return;

    const quantiteRestante = selectedDetail.quantite_empruntee - 
                            selectedDetail.quantite_retournee - 
                            selectedDetail.quantite_vendue;

    if (quantiteVente > quantiteRestante) {
      notifications.show({
        title: 'Erreur',
        message: `Quantité restante: ${quantiteRestante}`,
        color: 'red'
      });
      return;
    }

    setUpdating(true);
    try {
      const result = await temporaryResellerRepository.vendreProduits(
        emprunt.idEmprunt,
        [{
          idEmpruntDetail: selectedDetail.idEmpruntDetail,
          quantite: quantiteVente,
          prixVente: prixVente
        }]
      );

      notifications.show({
        title: '✅ Succès',
        message: `${quantiteVente} unité(s) vendue(s) - Total: ${result.total.toLocaleString()} FCFA`,
        color: 'green'
      });

      setVenteModal(false);
      setSelectedDetail(null);
      setQuantiteVente(1);
      setPrixVente(0);
      loadDetails();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: '❌ Erreur',
        message: error.message || 'Erreur lors de la vente',
        color: 'red'
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const colors: Record<string, string> = {
      'EN_COURS': 'blue',
      'RETOURNE': 'green',
      'PARTIELLEMENT_RETOURNE': 'orange',
      'VENDU': 'teal',
      'PERDU': 'red'
    };
    const labels: Record<string, string> = {
      'EN_COURS': 'En cours',
      'RETOURNE': 'Retourné',
      'PARTIELLEMENT_RETOURNE': 'Retour partiel',
      'VENDU': 'Vendu',
      'PERDU': 'Perdu'
    };
    return <Badge color={colors[statut] || 'gray'}>{labels[statut] || statut}</Badge>;
  };

  const statutGlobal = emprunt?.statut || 'EN_COURS';

  return (
    <Stack>
      <LoadingOverlay visible={loading} />

      {/* En-tête */}
      <Card withBorder p="sm">
        <Group justify="space-between">
          <div>
            <Text fw={700}>{emprunt?.code_emprunt}</Text>
            <Text size="xs" c="dimmed">Revendeur: {emprunt?.nom_revendeur}</Text>
            <Text size="xs" c="dimmed">Date: {new Date(emprunt?.date_emprunt).toLocaleDateString('fr-FR')}</Text>
          </div>
          <div>
            {getStatutBadge(statutGlobal)}
          </div>
        </Group>
      </Card>

      {/* Résumé */}
      <SimpleGrid cols={3} spacing="sm">
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">Montant total</Text>
          <Text fw={700} size="lg">{emprunt?.montant_total_emprunte?.toLocaleString()} F</Text>
        </Card>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">Retourné</Text>
          <Text fw={700} size="lg" c="green">{emprunt?.montant_total_retourne?.toLocaleString()} F</Text>
        </Card>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">Solde</Text>
          <Text fw={700} size="lg" c="blue">
            {(emprunt?.montant_total_emprunte - emprunt?.montant_total_retourne)?.toLocaleString()} F
          </Text>
        </Card>
      </SimpleGrid>

      <Divider label="Détails des produits" />

      {/* Liste des produits */}
      <ScrollArea h={250}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produit</Table.Th>
              <Table.Th>Emprunté</Table.Th>
              <Table.Th>Retourné</Table.Th>
              <Table.Th>Vendu</Table.Th>
              <Table.Th>Restant</Table.Th>
              <Table.Th>Prix unit.</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {details.map((detail) => {
              const restant = detail.quantite_empruntee - detail.quantite_retournee - detail.quantite_vendue;
              return (
                <Table.Tr key={detail.idEmpruntDetail}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{detail.designation}</Text>
                    <Text size="xs" c="dimmed">{detail.code_produit}</Text>
                  </Table.Td>
                  <Table.Td>{detail.quantite_empruntee}</Table.Td>
                  <Table.Td>{detail.quantite_retournee}</Table.Td>
                  <Table.Td>{detail.quantite_vendue}</Table.Td>
                  <Table.Td>
                    <Badge color={restant > 0 ? 'blue' : 'green'} size="sm">
                      {restant}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{detail.prix_vente_unitaire.toLocaleString()} F</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {restant > 0 && statutGlobal !== 'RETOURNE' && statutGlobal !== 'VENDU' && (
                        <>
                          <Button
                            size="xs"
                            color="green"
                            leftSection={<IconRotate size={12} />}
                            onClick={() => {
                              setSelectedDetail(detail);
                              setQuantiteRetour(1);
                              setRetourModal(true);
                            }}
                          >
                            Retour
                          </Button>
                          <Button
                            size="xs"
                            color="teal"
                            leftSection={<IconShoppingCart size={12} />}
                            onClick={() => {
                              setSelectedDetail(detail);
                              setQuantiteVente(1);
                              setPrixVente(detail.prix_vente_unitaire);
                              setVenteModal(true);
                            }}
                          >
                            Vente
                          </Button>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Modal Retour */}
      <Modal
        opened={retourModal}
        onClose={() => {
          setRetourModal(false);
          setSelectedDetail(null);
        }}
        title="Retour de produit"
        size="sm"
      >
        <Stack>
          {selectedDetail && (
            <>
              <Text size="sm">
                Produit: <strong>{selectedDetail.designation}</strong>
              </Text>
              <Text size="sm">
                Quantité restante: <strong>{selectedDetail.quantite_empruntee - selectedDetail.quantite_retournee - selectedDetail.quantite_vendue}</strong>
              </Text>
              <NumberInput
                label="Quantité à retourner"
                value={quantiteRetour}
                onChange={(val) => setQuantiteRetour(Number(val) || 1)}
                min={1}
                max={selectedDetail.quantite_empruntee - selectedDetail.quantite_retournee - selectedDetail.quantite_vendue}
                required
              />
              <Group justify="flex-end">
                <Button variant="light" onClick={() => setRetourModal(false)}>Annuler</Button>
                <Button onClick={handleRetour} loading={updating} color="green">
                  Confirmer le retour
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* Modal Vente */}
      <Modal
        opened={venteModal}
        onClose={() => {
          setVenteModal(false);
          setSelectedDetail(null);
        }}
        title="Vente de produit"
        size="sm"
      >
        <Stack>
          {selectedDetail && (
            <>
              <Text size="sm">
                Produit: <strong>{selectedDetail.designation}</strong>
              </Text>
              <Text size="sm">
                Quantité restante: <strong>{selectedDetail.quantite_empruntee - selectedDetail.quantite_retournee - selectedDetail.quantite_vendue}</strong>
              </Text>
              <NumberInput
                label="Quantité à vendre"
                value={quantiteVente}
                onChange={(val) => setQuantiteVente(Number(val) || 1)}
                min={1}
                max={selectedDetail.quantite_empruntee - selectedDetail.quantite_retournee - selectedDetail.quantite_vendue}
                required
              />
              <NumberInput
                label="Prix de vente unitaire"
                value={prixVente}
                onChange={(val) => setPrixVente(Number(val) || 0)}
                min={0}
                step={100}
                leftSection="FCFA"
                required
              />
              <Text size="sm" fw={600}>
                Total: {(quantiteVente * prixVente).toLocaleString()} FCFA
              </Text>
              <Group justify="flex-end">
                <Button variant="light" onClick={() => setVenteModal(false)}>Annuler</Button>
                <Button onClick={handleVente} loading={updating} color="teal">
                  Confirmer la vente
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
};