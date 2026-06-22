// src/components/decomptes/PrintRecuDecompte.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Group, Loader, Center, Stack, Paper, Text, Alert } from '@mantine/core';
import { IconPrinter, IconArrowLeft, IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { getDb } from '../../database/db';
import RecuDecompte from './RecuDecompte';

interface DecompteDetail {
  categorie: string;
  unite_base: string;
  idProduit: number;
  designation: string;
  qte_decompte: number;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
  code_produit?: string;
}

interface DecompteData {
  idDecompte: number;
  code_decompte: string;
  date_decompte: string;
  montant_vente: number;
  montant_commission: number;
  montant_net: number;
  observation?: string;
  NomComplet: string;
  details: DecompteDetail[];
}

export default function PrintRecuDecompte() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [decompte, setDecompte] = useState<DecompteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDecompte = async () => {
      if (!id) {
        setError("ID du décompte manquant");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const db = await getDb();
        const decompteId = parseInt(id);

        if (isNaN(decompteId)) {
          setError("ID du décompte invalide");
          setLoading(false);
          return;
        }

        // Récupérer le décompte
        const decompteData = await db.select<any[]>(`
          SELECT 
            d.idDecompte,
            d.code_decompte,
            d.date_decompte,
            d.montant_vente,
            d.montant_commission,
            d.montant_net,
            d.montant_achat,
            d.montant_benefice,
            d.observation,
            d.taux_commission,
            c.NomComplet,
            c.Societe,
            c.Tel
          FROM decomptes d
          LEFT JOIN clients c ON c.idClient = d.idClient
          WHERE d.idDecompte = ?
        `, [decompteId]);

        if (decompteData.length === 0) {
          setError("Décompte non trouvé");
          setLoading(false);
          return;
        }

        // Récupérer les détails
        const detailsData = await db.select<any[]>(`
          SELECT 
            dd.idDetailRevendeur,
            dd.idProduit,
            dd.qte_decompte,
            dd.prix_achat,
            dd.prix_vente,
            dd.commission_pourcentage,
            dd.designation as detail_designation,
            p.designation,
            p.code_produit,
            p.unite_base,
            p.categorie
          FROM decompte_details dd
          LEFT JOIN products p ON p.idProduit = dd.idProduit
          WHERE dd.idDecompte = ?
          ORDER BY dd.idDetailRevendeur ASC
        `, [decompteId]);

        // Transformer les détails
        const recuDetails: DecompteDetail[] = (detailsData || []).map((detail: any) => ({
          idProduit: detail.idProduit || 0,
          designation: detail.detail_designation || detail.designation || 'Produit',
          qte_decompte: detail.qte_decompte || 0,
          prix_achat: detail.prix_achat || 0,
          prix_vente: detail.prix_vente || 0,
          commission_pourcentage: detail.commission_pourcentage || 60,
          code_produit: detail.code_produit || '',
          categorie: detail.categorie || 'Catégorie inconnue',
          unite_base: detail.unite_base || 'Unité inconnue'
        }));

        // Construire l'objet décompte
        const decompteObj: DecompteData = {
          idDecompte: decompteData[0].idDecompte,
          code_decompte: decompteData[0].code_decompte || `DC-${decompteData[0].idDecompte}`,
          date_decompte: decompteData[0].date_decompte || new Date().toISOString(),
          montant_vente: decompteData[0].montant_vente || 0,
          montant_commission: decompteData[0].montant_commission || 0,
          montant_net: decompteData[0].montant_net || 0,
          observation: decompteData[0].observation,
          NomComplet: decompteData[0].NomComplet || 'Client',
          details: recuDetails
        };

        setDecompte(decompteObj);

      } catch (error: any) {
        console.error('Erreur chargement décompte:', error);
        setError(error?.message || 'Erreur lors du chargement du décompte');
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
      console.log('✅ Impression lancée');
    },
    onPrintError: (error) => {
      console.error('❌ Erreur impression:', error);
      setError('Erreur lors de l\'impression');
    }
  });

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement du décompte...</Text>
      </Center>
    );
  }

  if (error) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md" style={{ maxWidth: 500 }}>
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            title="Erreur" 
            color="red"
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
          <Group>
            <Button 
              leftSection={<IconRefresh size={16} />}
              onClick={() => window.location.reload()}
              variant="light"
            >
              Réessayer
            </Button>
            <Button 
              variant="subtle"
              onClick={() => navigate('/decomptes')}
            >
              Retour à la liste
            </Button>
          </Group>
        </Stack>
      </Center>
    );
  }

  if (!decompte) {
    return (
      <Center py={100}>
        <Stack align="center">
          <Text size="lg" c="dimmed">Décompte non trouvé</Text>
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
          date={decompte.date_decompte}
          client={decompte.NomComplet}
          details={decompte.details.map(detail => ({
            qte_decompte: detail.qte_decompte,
            prix_achat: detail.prix_achat,
            prix_vente: detail.prix_vente,
            commission_pourcentage: detail.commission_pourcentage,
            designation: detail.designation,
            categorie: detail.categorie || '-',
            unite_base: detail.unite_base || 'pièce'
          }))}
        />
      </div>
    </Stack>
  );
}