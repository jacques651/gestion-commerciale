// src/components/decomptes/PrintRecuDecompte.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Group, Loader, Center, Stack, Paper, Text } from '@mantine/core';
import { IconPrinter, IconArrowLeft } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { getDb } from '../../database/db';
import RecuDecompte, { RecuDecompteDetail } from './RecuDecompte';

interface DecompteRow {
  idDecompte: number;
  code_decompte: string;
  date_decompte: string;
  montant_vente: number;
  montant_commission: number;
  montant_net: number;
  observation: string;
  NomComplet: string;
  Societe: string;
  Tel: string;
}

interface DetailRow {
  idDetailRevendeur: number;
  idProduit: number;
  qte_decompte: number;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
  designation: string;
  code_produit: string;
}

export default function PrintRecuDecompte() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [decompte, setDecompte] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDecompte = async () => {
      if (!id) return;
      
      try {
        const db = await getDb();
        
        // Récupérer le décompte avec typage explicite
        const decompteData = await db.select<DecompteRow[]>(`
          SELECT 
            d.idDecompte,
            d.code_decompte,
            d.date_decompte,
            d.montant_vente,
            d.montant_commission,
            d.montant_net,
            d.observation,
            c.NomComplet,
            c.Societe,
            c.Tel
          FROM decomptes d
          LEFT JOIN clients c ON c.idClient = d.idClient
          WHERE d.idDecompte = ?
        `, [parseInt(id)]);
        
        if (!decompteData || decompteData.length === 0) {
          console.error('Décompte non trouvé');
          setLoading(false);
          return;
        }
        
        const decompteRow = decompteData[0];
        
        // Récupérer les détails du décompte avec typage explicite
        const detailsData = await db.select<DetailRow[]>(`
          SELECT 
            dd.idDetailRevendeur,
            dd.idProduit,
            dd.qte_decompte,
            dd.prix_achat,
            dd.prix_vente,
            dd.commission_pourcentage,
            p.designation,
            p.code_produit
          FROM decompte_details dd
          LEFT JOIN products p ON p.idProduit = dd.idProduit
          WHERE dd.idDecompte = ?
        `, [parseInt(id)]);
        
        // Transformer les données pour RecuDecompte
        const recuDetails: RecuDecompteDetail[] = (detailsData || []).map((detail: DetailRow) => ({
          idProduit: detail.idProduit,
          codeFacture: `FACT-${detail.idProduit}`,
          designation: detail.designation || 'Produit',
          qteInitiale: detail.qte_decompte || 0,
          qteVendue: detail.qte_decompte || 0,
          qteRestante: 0,
          prixAchat: detail.prix_achat || 0,
          prixVente: detail.prix_vente || 0,
          commissionPourcentage: detail.commission_pourcentage || 60
        }));
        
        setDecompte({
          id: decompteRow.idDecompte,
          code_decompte: decompteRow.code_decompte || `DC-${decompteRow.idDecompte}`,
          date_decompte: decompteRow.date_decompte,
          NomComplet: decompteRow.NomComplet || 'Client',
          details: recuDetails
        });
        
      } catch (error) {
        console.error('Erreur chargement décompte:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadDecompte();
  }, [id]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Recu_Decompte_${decompte?.code_decompte || id}`,
    onAfterPrint: () => {
      console.log('Impression lancée');
    }
  });

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  if (!decompte) {
    return (
      <Center py={100}>
        <Stack align="center">
          <Text>Décompte non trouvé</Text>
          <Button onClick={() => navigate('/decomptes')}>Retour</Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md" p="md">
      {/* Barre d'outils */}
      <Paper p="md" withBorder style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'white' }}>
        <Group justify="space-between">
          <Button 
            variant="light" 
            leftSection={<IconArrowLeft size={16} />} 
            onClick={() => navigate('/decomptes')}
          >
            Retour
          </Button>
          <Button 
            variant="filled" 
            color="blue" 
            leftSection={<IconPrinter size={16} />} 
            onClick={handlePrint}
          >
            Imprimer le reçu
          </Button>
        </Group>
      </Paper>

      {/* Contenu à imprimer */}
      <div ref={printRef}>
        <RecuDecompte
          numero={decompte.code_decompte}
          date={decompte.date_decompte ? new Date(decompte.date_decompte).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}
          client={decompte.NomComplet}
          details={decompte.details}
        />
      </div>
    </Stack>
  );
}