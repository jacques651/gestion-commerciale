import React, { useEffect, useState } from "react";
import { Modal, Stack, Text, Group, Button, Divider, Paper, Table, SimpleGrid, Title } from "@mantine/core";
import { IconPrinter } from "@tabler/icons-react";
import { getDb } from "../../database/db";

interface ProduitVente {
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
}

interface ReçuVenteProps {
  vente: { idVente: number; nom_prenom: string; contact: string; date_vente: string; montant_total: number };
  onClose: () => void;
}

const ReçuVente: React.FC<ReçuVenteProps> = ({ vente, onClose }) => {
  const [produits, setProduits] = useState<ProduitVente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const chargerDetails = async () => {
      const db = await getDb();
      const result = await db.select<ProduitVente[]>(`
        SELECT p.designation, vd.quantite, vd.prix_unitaire, (vd.quantite * vd.prix_unitaire) as total
        FROM vente_details vd
        JOIN products p ON vd.idProduit = p.idProduit
        WHERE vd.idVente = ?
      `, [vente.idVente]);
      setProduits(result);
      setLoading(false);
    };
    chargerDetails();
  }, [vente.idVente]);

  const handlePrint = () => window.print();

  if (loading) return null;

  return (
    <Modal opened={true} onClose={onClose} size="md" centered title="Reçu de vente" styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: 0 } }}>
      <div id="print-recu">
        <Stack gap={0}>
          <Paper p="lg" radius={0}><Title order={3} ta="center">REÇU DE VENTE</Title><Text ta="center" size="sm">{new Date(vente.date_vente).toLocaleDateString("fr-FR")}</Text></Paper>
          <Divider />
          <Paper p="lg" radius={0}><SimpleGrid cols={2}><Text fw={600}>Client :</Text><Text>{vente.nom_prenom}</Text><Text fw={600}>Contact :</Text><Text>{vente.contact || "-"}</Text></SimpleGrid></Paper>
          <Divider />
          <Paper p="lg" radius={0}>
            <Table><Table.Thead><Table.Tr><Table.Th>Désignation</Table.Th><Table.Th>Qté</Table.Th><Table.Th>PU</Table.Th><Table.Th>Total</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{produits.map((p, i) => (<Table.Tr key={i}><Table.Td>{p.designation}</Table.Td><Table.Td>{p.quantite}</Table.Td><Table.Td>{p.prix_unitaire.toLocaleString()} FCFA</Table.Td><Table.Td>{p.total.toLocaleString()} FCFA</Table.Td></Table.Tr>))}</Table.Tbody></Table>
          </Paper>
          <Divider />
          <Paper p="lg" radius={0}><Group justify="flex-end"><Text fw={700} size="lg">Total : {vente.montant_total.toLocaleString()} FCFA</Text></Group></Paper>
          <Divider /><Paper p="lg" radius={0}><Text ta="center" size="xs" c="dimmed">Merci de votre visite !</Text></Paper>
        </Stack>
      </div>
      <Divider /><Group justify="flex-end" p="md" className="no-print"><Button variant="light" onClick={onClose}>Fermer</Button><Button onClick={handlePrint} leftSection={<IconPrinter size={16} />}>Imprimer</Button></Group>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </Modal>
  );
};

export default ReçuVente;