// src/components/reglements/FormulaireReglement.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, Select, NumberInput, TextInput, Button, Group, Stack,
  LoadingOverlay, Paper, Text, SimpleGrid, Badge,
  Table, ScrollArea, Card, Radio
} from '@mantine/core';
import { useReglements } from '../../hooks/useReglements';
import { notifications } from '@mantine/notifications';

import {
  IconCash, IconFileInvoice
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { journalCaisseService } from '../../services/journalCaisseService';

interface FormulaireReglementProps {
  opened: boolean;
  onClose: () => void;
  idFacture?: number;
  idClient?: number;
  montantMax?: number;
}

interface Client {
  idClient: number;
  NomComplet: string;
  Societe: string;
  Tel: string;
}

interface Facture {
  idFacture: number;
  code_facture: string;
  date_facture: string;
  montant_ttc: number;
  montant_regle: number;
  montant_restant: number;
  statut: string;
}

export const FormulaireReglement: React.FC<FormulaireReglementProps> = ({
  opened, onClose, idFacture: propIdFacture, idClient: propIdClient
}) => {
  const { createReglement } = useReglements();
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeReglement, setCodeReglement] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [montantAPayer, setMontantAPayer] = useState<number>(0);
  const [modeReglement, setModeReglement] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [observation, setObservation] = useState('');
  const [typePaiement, setTypePaiement] = useState<'total' | 'partiel'>('total');

  const modesReglement = [
    { value: 'ESPECES', label: '💰 Espèces' },
    { value: 'CHEQUE', label: '📝 Chèque' },
    { value: 'VIREMENT', label: '🏦 Virement bancaire' },
    { value: 'CARTE', label: '💳 Carte bancaire' },
    { value: 'MOBILE_MONEY', label: '📱 Mobile Money' },
  ];

  const loadClients = async () => {
    try {
      const db = await getDb();
      const result = await db.select<Client[]>(`
        SELECT idClient, NomComplet, Societe, Tel
        FROM clients
        ORDER BY NomComplet
      `);
      setClients(result);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  // Fonction pour calculer le montant réellement réglé d'une facture
  const getTotalRegleFacture = async (idFacture: number): Promise<number> => {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT COALESCE(SUM(montant), 0) as total
      FROM reglements
      WHERE idFacture = ?
    `, [idFacture]);
    return result[0]?.total || 0;
  };

  // Charger les factures d'un client avec calcul réel du reste
  const loadFactures = async (clientId: number) => {
    try {
      const db = await getDb();

      // Récupérer les factures du client
      const facturesData = await db.select<any[]>(`
        SELECT 
          idFacture,
          code_facture,
          date_facture,
          montant_ttc,
          COALESCE(montant_regle, 0) as montant_regle,
          statut
        FROM factures
        WHERE idClient = ? AND statut != 'REGLEE' AND statut != 'ANNULEE'
        ORDER BY date_facture ASC
      `, [clientId]);

      const facturesAvecReste = [];

      for (const facture of facturesData) {
        // Calculer le vrai montant réglé depuis la table reglements
        const totalRegle = await getTotalRegleFacture(facture.idFacture);
        const montantRestant = facture.montant_ttc - totalRegle;

        if (montantRestant > 0) {
          facturesAvecReste.push({
            idFacture: facture.idFacture,
            code_facture: facture.code_facture,
            date_facture: facture.date_facture,
            montant_ttc: facture.montant_ttc,
            montant_regle: totalRegle,
            montant_restant: montantRestant,
            statut: facture.statut
          });
        }
      }

      setFactures(facturesAvecReste);
      setSelectedFacture(null);
      setMontantAPayer(0);
      setTypePaiement('total');
    } catch (error) {
      console.error('Erreur chargement factures:', error);
    }
  };

  // Générer le code règlement
  useEffect(() => {
    const generateCode = async () => {
      if (opened) {
        setGeneratingCode(true);
        try {
          const code = await getNextReglementCode();
          setCodeReglement(code);
        } catch (error) {
          setCodeReglement(`REG-${Date.now()}`);
        } finally {
          setGeneratingCode(false);
        }
      }
    };
    generateCode();
    loadClients();
  }, [opened]);

  // Si idFacture est passé en prop, charger directement la facture avec calcul du vrai reste
  useEffect(() => {
    if (propIdFacture && opened) {
      const loadFactureDirect = async () => {
        const db = await getDb();

        // Récupérer la facture
        const factureData = await db.select<any[]>(`
          SELECT 
            f.idFacture,
            f.code_facture,
            f.date_facture,
            f.montant_ttc,
            COALESCE(f.montant_regle, 0) as montant_regle,
            f.statut,
            c.idClient,
            c.NomComplet,
            c.Societe,
            c.Tel
          FROM factures f
          LEFT JOIN clients c ON c.idClient = f.idClient
          WHERE f.idFacture = ?
        `, [propIdFacture]);

        if (factureData.length > 0) {
          const row = factureData[0];

          // Calculer le vrai montant réglé depuis la table reglements
          const totalRegle = await getTotalRegleFacture(propIdFacture);
          const montantRestant = row.montant_ttc - totalRegle;

          setSelectedClient({
            idClient: row.idClient,
            NomComplet: row.NomComplet,
            Societe: row.Societe,
            Tel: row.Tel
          });

          const facture = {
            idFacture: row.idFacture,
            code_facture: row.code_facture,
            date_facture: row.date_facture,
            montant_ttc: row.montant_ttc,
            montant_regle: totalRegle,
            montant_restant: montantRestant > 0 ? montantRestant : 0,
            statut: row.statut
          };

          setSelectedFacture(facture);
          setFactures([facture]);
          setMontantAPayer(montantRestant > 0 ? montantRestant : 0);
        }
      };
      loadFactureDirect();
    }
  }, [propIdFacture, opened]);

  // Si idClient est passé en prop, charger directement ses factures
  useEffect(() => {
    if (propIdClient && opened && !propIdFacture) {
      const client = clients.find(c => c.idClient === propIdClient);
      if (client) {
        setSelectedClient(client);
        loadFactures(propIdClient);
      }
    }
  }, [propIdClient, opened, clients, propIdFacture]);

  // Mettre à jour le montant à payer quand le type de paiement change
  useEffect(() => {
    if (selectedFacture) {
      if (typePaiement === 'total') {
        setMontantAPayer(selectedFacture.montant_restant);
      }
    }
  }, [typePaiement, selectedFacture]);

  // Enregistrer le règlement
  const handleSubmit = async () => {
    if (!selectedClient) {
      notifications.show({ title: 'Erreur', message: 'Sélectionnez un client', color: 'red' });
      return;
    }

    if (!selectedFacture) {
      notifications.show({ title: 'Erreur', message: 'Sélectionnez une facture', color: 'red' });
      return;
    }

    if (!modeReglement) {
      notifications.show({ title: 'Erreur', message: 'Sélectionnez un mode de règlement', color: 'red' });
      return;
    }

    if (montantAPayer <= 0) {
      notifications.show({ title: 'Erreur', message: 'Montant invalide', color: 'red' });
      return;
    }

    if (montantAPayer > selectedFacture.montant_restant) {
      notifications.show({
        title: 'Erreur',
        message: `Le montant ne peut pas dépasser le solde restant (${selectedFacture.montant_restant.toLocaleString()} FCFA)`,
        color: 'red'
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Créer le règlement
      await createReglement({
        idClient: selectedClient.idClient,
        idFacture: selectedFacture.idFacture,
        idDecompte: null,
        montant: montantAPayer,
        mode_reglement: modeReglement,
        reference: reference || null,
        observation: observation || null,
      });

      // 2. ✅ AJOUTER AU JOURNAL DE CAISSE
      try {
        await journalCaisseService.ajouterReglementFacture({
          montant: montantAPayer,
          idFacture: selectedFacture.idFacture,
          codeFacture: selectedFacture.code_facture,
          clientNom: selectedClient.NomComplet
        });
        console.log('✅ Journal de caisse mis à jour pour le règlement', codeReglement);
      } catch (journalError) {
        console.error('Erreur journal de caisse:', journalError);
        // Ne pas bloquer le règlement si le journal échoue
      }

      notifications.show({
        title: '✅ Succès',
        message: `Règlement ${codeReglement} enregistré avec succès`,
        color: 'green',
      });

      onClose();

    } catch (error) {
      console.error(error);
      notifications.show({
        title: '❌ Erreur',
        message: 'Erreur lors de l\'enregistrement du règlement',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const clientOptions = clients.map(c => ({
    value: c.idClient.toString(),
    label: `${c.NomComplet}${c.Societe ? ` (${c.Societe})` : ''}`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      padding="xl"
      centered
      styles={{
        header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
        title: { color: 'white', fontWeight: 700 },
        body: { padding: 0 }
      }}
      title={
        <Group gap="xs">
          <IconCash size={22} color="white" />
          <Text fw={700} size="lg" c="white">Nouveau règlement de facture</Text>
        </Group>
      }
    >
      <LoadingOverlay visible={generatingCode || loading} />

      <Stack gap="md" p="xl">
        {/* Code règlement */}
        <Paper p="md" withBorder bg="gray.0">
          <SimpleGrid cols={2} spacing="md">
            <div>
              <Text size="xs" c="dimmed">Code règlement</Text>
              <Text fw={700} size="lg">{codeReglement}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Date</Text>
              <Text>{new Date().toLocaleDateString('fr-FR')}</Text>
            </div>
          </SimpleGrid>
        </Paper>

        {/* Sélection du client */}
        <Card withBorder>
          <Select
            label="Client"
            placeholder="Sélectionner un client"
            data={clientOptions}
            value={selectedClient?.idClient?.toString() || null}
            onChange={(value) => {
              const client = clients.find(c => c.idClient.toString() === value);
              setSelectedClient(client || null);
              if (client) {
                loadFactures(client.idClient);
              } else {
                setFactures([]);
                setSelectedFacture(null);
                setMontantAPayer(0);
              }
            }}
            searchable
            clearable
            disabled={!!propIdFacture}
          />

          {selectedClient && (
            <Paper p="sm" withBorder mt="sm">
              <SimpleGrid cols={2} spacing="md">
                <div>
                  <Text size="xs" c="dimmed">Client</Text>
                  <Text fw={500}>{selectedClient.NomComplet}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Contact</Text>
                  <Text>{selectedClient.Tel || '-'}</Text>
                </div>
              </SimpleGrid>
            </Paper>
          )}
        </Card>

        {/* Liste des factures */}
        {selectedClient && factures.length > 0 && (
          <Card withBorder shadow="sm" p="md">
            <Group gap="xs" mb="md">
              <IconFileInvoice size={18} color="#1b365d" />
              <Text fw={600}>Liste des factures</Text>
            </Group>

            <ScrollArea h={300}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={50}>Sélection</Table.Th>
                    <Table.Th>Réf facture</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th ta="right">Montant TTC</Table.Th>
                    <Table.Th ta="right">Déjà réglé</Table.Th>
                    <Table.Th ta="right">Solde restant</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {factures.map((facture) => (
                    <Table.Tr
                      key={facture.idFacture}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedFacture?.idFacture === facture.idFacture ? '#e8f5e9' : undefined
                      }}
                      onClick={() => {
                        setSelectedFacture(facture);
                        setTypePaiement('total');
                        setMontantAPayer(facture.montant_restant);
                      }}
                    >
                      <Table.Td>
                        <Radio
                          checked={selectedFacture?.idFacture === facture.idFacture}
                          onChange={() => {
                            setSelectedFacture(facture);
                            setTypePaiement('total');
                            setMontantAPayer(facture.montant_restant);
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{facture.code_facture}</Text>
                      </Table.Td>
                      <Table.Td>
                        {new Date(facture.date_facture).toLocaleDateString('fr-FR')}
                      </Table.Td>
                      <Table.Td ta="right">
                        {facture.montant_ttc.toLocaleString()} FCFA
                      </Table.Td>
                      <Table.Td ta="right">
                        {facture.montant_regle.toLocaleString()} FCFA
                      </Table.Td>
                      <Table.Td ta="right">
                        <Badge color={facture.montant_restant === 0 ? 'green' : 'orange'} variant="light">
                          {facture.montant_restant.toLocaleString()} FCFA
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        )}

        {/* Formulaire de règlement */}
        {selectedFacture && (
          <Card withBorder>
            <Stack gap="md">
              <Paper p="sm" withBorder>
                <SimpleGrid cols={2} spacing="md">
                  <div>
                    <Text size="xs" c="dimmed">Facture</Text>
                    <Text fw={600}>{selectedFacture.code_facture}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Solde restant</Text>
                    <Text fw={700} c="orange">{selectedFacture.montant_restant.toLocaleString()} FCFA</Text>
                  </div>
                </SimpleGrid>
              </Paper>

              <Select
                label="Mode de règlement"
                placeholder="Choisissez un mode"
                data={modesReglement}
                value={modeReglement}
                onChange={setModeReglement}
                required
              />

              <NumberInput
                label="Montant à payer"
                value={montantAPayer}
                onChange={(value) => setMontantAPayer(Number(value) || 0)}
                min={0}
                max={selectedFacture.montant_restant}
                step={1000}
                required
              />

              <TextInput
                label="Référence"
                placeholder="Numéro de chèque..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />

              <TextInput
                label="Observation"
                placeholder="Commentaire..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
              />
            </Stack>
          </Card>
        )}

        {/* Actions */}
        <Group justify="flex-end">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            loading={loading}
            color="green"
            onClick={handleSubmit}
            disabled={!selectedClient || !selectedFacture || !modeReglement || montantAPayer <= 0}
          >
            Enregistrer
          </Button>
        </Group>

        {selectedClient && factures.length === 0 && (
          <Paper p="xl" ta="center" withBorder>
            <Text c="dimmed">Aucune facture impayée pour ce client</Text>
          </Paper>
        )}
      </Stack>
    </Modal>
  );
};

export default FormulaireReglement;

async function getNextReglementCode(): Promise<string> {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT MAX(idReglement) AS lastId
    FROM reglements
  `);

  const lastId = result[0]?.lastId || 0;
  const nextId = Number(lastId) + 1;
  return `REG-${String(nextId).padStart(5, '0')}`;
}