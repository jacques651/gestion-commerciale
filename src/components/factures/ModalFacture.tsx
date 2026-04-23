// src/components/factures/ModalFacture.tsx
import React from 'react';
import { Modal, Stack, Text, Group, Button, Divider, Paper, Table, SimpleGrid, Title } from '@mantine/core';
import { IconPrinter, IconX } from '@tabler/icons-react';

interface ModalFactureProps { facture: any; onClose: () => void; }

const ModalFacture: React.FC<ModalFactureProps> = ({ facture, onClose }) => {
  const handlePrint = () => window.print();

  return (
    <Modal opened={true} onClose={onClose} size="xl" centered title="Facture" styles={{ header: { backgroundColor: '#1b365d', padding: '16px 20px' }, title: { color: 'white', fontWeight: 600 }, body: { padding: 0 } }}>
      <div id="print-facture">
        <Stack gap={0}>
          <Paper p="lg" radius={0}><Title order={3} ta="center">FACTURE</Title><Text ta="center" size="sm">{facture.code_facture}</Text></Paper>
          <Divider />
          <Paper p="lg" radius={0}><SimpleGrid cols={2}><Text fw={600}>Client:</Text><Text>{facture.client_nom}</Text><Text fw={600}>Date:</Text><Text>{new Date(facture.date_facture).toLocaleDateString('fr-FR')}</Text></SimpleGrid></Paper>
          <Divider />
          <Paper p="lg" radius={0}>
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={600}>Montant HT</Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{facture.montant_ht?.toLocaleString()} FCFA</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={600}>TVA (18%)</Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{((facture.montant_ht || 0) * 0.18).toLocaleString()} FCFA</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr style={{ backgroundColor: '#f0f9ff' }}>
                  <Table.Td fw={700}>Total TTC</Table.Td>
                  <Table.Td ta="right" fw={700}>
                    <Text size="lg" c="blue">{facture.montant_ttc.toLocaleString()} FCFA</Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>
        </Stack>
      </div>
      <Divider />
      <Group justify="flex-end" p="md" className="no-print">
        <Button variant="light" onClick={onClose} leftSection={<IconX size={16} />}>Fermer</Button>
        <Button onClick={handlePrint} leftSection={<IconPrinter size={16} />}>Imprimer</Button>
      </Group>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </Modal>
  );
};

export default ModalFacture;