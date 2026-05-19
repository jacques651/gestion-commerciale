// src/components/factures/ModalFacture.tsx
import React from 'react';
import { Modal, Stack, Text, Group, Button, Divider, Paper, Table, SimpleGrid, Title, Badge } from '@mantine/core';
import { IconPrinter, IconX } from '@tabler/icons-react';

interface ModalFactureProps { 
  facture: any; 
  onClose: () => void; 
}

const ModalFacture: React.FC<ModalFactureProps> = ({ facture, onClose }) => {
  const handlePrint = () => window.print();

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString();
  };

  const getTypeFactureBadge = (type: string) => {
    if (type === 'REVENDEUR') {
      return <Badge color="orange" variant="light" size="sm">Facture Revendeur</Badge>;
    }
    return <Badge color="blue" variant="light" size="sm">Facture Standard</Badge>;
  };

  const montantHT = facture.montant_ht || facture.MontantHT || 0;
  const montantTTC = facture.montant_ttc || facture.MontantTTC || 0;
  const tva = montantHT * 0.18;

  return (
    <Modal 
      opened={true} 
      onClose={onClose} 
      size="xl" 
      centered 
      title="Facture" 
      styles={{ 
        header: { backgroundColor: '#1b365d', padding: '16px 20px' }, 
        title: { color: 'white', fontWeight: 600 }, 
        body: { padding: 0 } 
      }}
    >
      <div id="print-facture">
        <Stack gap={0}>
          {/* En-tête */}
          <Paper p="lg" radius={0} bg="#1b365d" c="white">
            <Title order={3} ta="center" c="white">FACTURE</Title>
            <Text ta="center" size="sm" c="gray.3">{facture.code_facture || facture.CodeFacture || '-'}</Text>
            <Group justify="center" mt="xs">
              {getTypeFactureBadge(facture.type_facture || facture.TypeFacture)}
            </Group>
          </Paper>
          
          <Divider />
          
          {/* Informations client */}
          <Paper p="lg" radius={0}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Text fw={600} size="sm" c="dimmed">Client:</Text>
                <Text>{facture.client_nom || facture.NomComplet || 'Client inconnu'}</Text>
              </div>
              <div>
                <Text fw={600} size="sm" c="dimmed">Date:</Text>
                <Text>{facture.date_facture ? new Date(facture.date_facture).toLocaleDateString('fr-FR') : '-'}</Text>
              </div>
              {facture.client_societe && (
                <div>
                  <Text fw={600} size="sm" c="dimmed">Société:</Text>
                  <Text>{facture.client_societe}</Text>
                </div>
              )}
              {facture.commande_code && (
                <div>
                  <Text fw={600} size="sm" c="dimmed">Commande:</Text>
                  <Text>{facture.commande_code}</Text>
                </div>
              )}
            </SimpleGrid>
          </Paper>
          
          <Divider />
          
          {/* Détails des produits si disponibles */}
          {facture.details && facture.details.length > 0 && (
            <>
              <Paper p="lg" radius={0}>
                <Title order={5} mb="md">Produits</Title>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Désignation</Table.Th>
                      <Table.Th>Qté</Table.Th>
                      <Table.Th>Prix unit.</Table.Th>
                      <Table.Th>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {facture.details.map((detail: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td>{detail.produit_nom || detail.designation || '-'}</Table.Td>
                        <Table.Td>{detail.quantite || detail.qte_commande}</Table.Td>
                        <Table.Td>{formatMontant(detail.prix_unitaire_vente || detail.prix_vente)} F</Table.Td>
                        <Table.Td>{formatMontant((detail.prix_unitaire_vente || detail.prix_vente || 0) * (detail.quantite || detail.qte_commande || 0))} F</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
              <Divider />
            </>
          )}
          
          {/* Récapitulatif financier */}
          <Paper p="lg" radius={0}>
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={600}>Montant HT</Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{formatMontant(montantHT)} FCFA</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={600}>TVA (18%)</Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{formatMontant(tva)} FCFA</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr style={{ backgroundColor: '#f0f9ff' }}>
                  <Table.Td fw={700}>Total TTC</Table.Td>
                  <Table.Td ta="right" fw={700}>
                    <Text size="lg" c="blue">{formatMontant(montantTTC)} FCFA</Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>

          {/* Montant en lettres */}
          <Paper p="lg" radius={0} bg="gray.0">
            <Text size="sm" c="dimmed">Arrêté la présente facture à la somme de :</Text>
            <Text fw={600}>{montantEnLettres(montantTTC)} Francs CFA</Text>
          </Paper>
        </Stack>
      </div>
      
      <Divider />
      
      <Group justify="flex-end" p="md" className="no-print">
        <Button variant="light" onClick={onClose} leftSection={<IconX size={16} />}>
          Fermer
        </Button>
        <Button onClick={handlePrint} leftSection={<IconPrinter size={16} />} color="teal">
          Imprimer
        </Button>
      </Group>
      
      <style>{`
        @media print { 
          .no-print { display: none !important; } 
          body { padding: 0; margin: 0; }
          #print-facture { margin: 0; padding: 0; }
        }
      `}</style>
    </Modal>
  );
};

// Fonction pour convertir le montant en lettres (simplifiée)
function montantEnLettres(montant: number): string {
  if (!montant || montant === 0) return 'Zéro';
  const nombre = Math.floor(montant);
  return `${nombre.toLocaleString()} (${nombre.toString()} francs CFA)`;
}

export default ModalFacture;