// src/hooks/useReglements.ts
import { useState, useEffect, useCallback } from 'react';
import { getDb } from '../database/db';
import { notifications } from '@mantine/notifications';


export interface Reglement {
  idReglement: number;
  code_reglement: string;
  idClient: number;
  idFacture: number | null;
  idVente: number | null;
  date_reglement: string;
  montant: number;
  mode_reglement: string;
  reference: string | null;
  banque: string | null;
  numero_cheque: string | null;
  observation: string | null;
  client_nom?: string;
}

export interface CreateReglementInput {
  idClient: number | null;
  idFacture: number | null;
  idDecompte?: number | null;
  montant: number;
  mode_reglement: string;
  reference: string | null;
  observation: string | null;
}

export const useReglements = () => {
  const [reglements, setReglements] = useState<Reglement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReglements = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      
      const result = await db.select<any[]>(`
        SELECT 
          r.*,
          cl.NomComplet as client_nom
        FROM reglements r
        LEFT JOIN clients cl ON r.idClient = cl.idClient
        ORDER BY r.date_reglement DESC
      `);
      
      setReglements(result);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement règlements:', err);
      setError('Erreur de chargement des règlements');
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors du chargement des règlements',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Récupérer un règlement par ID
  const getReglementById = useCallback(async (id: number) => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT 
          r.*,
          cl.NomComplet as client_nom
        FROM reglements r
        LEFT JOIN clients cl ON r.idClient = cl.idClient
        WHERE r.idReglement = ?
      `, [id]);
      return result[0] || null;
    } catch (err) {
      console.error('Erreur récupération règlement:', err);
      return null;
    }
  }, []);

  // ✅ Créer un règlement avec génération automatique du code
  const createReglement = useCallback(async (reglement: CreateReglementInput) => {
    try {
      // ✅ Générer le code règlement
      const codeReglement = await getNextReglementCode();
      
      const db = await getDb();
      const result = await db.execute(`
        INSERT INTO reglements (
          code_reglement,
          idClient,
          idFacture,
          idVente,
          date_reglement,
          montant,
          mode_reglement,
          reference,
          banque,
          numero_cheque,
          observation
        ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)
      `, [
        codeReglement,
        reglement.idClient || null,
        reglement.idFacture || null,
        reglement.idDecompte || null,  // idVente peut être utilisé pour les décomptes
        reglement.montant,
        reglement.mode_reglement,
        reglement.reference || null,
        null, // banque
        null, // numero_cheque
        reglement.observation || null
      ]);
      
      notifications.show({
        title: 'Succès',
        message: `Règlement ${codeReglement} enregistré avec succès`,
        color: 'green',
      });
      
      await loadReglements();
      return result.lastInsertId;
    } catch (err) {
      console.error('Erreur création règlement:', err);
      notifications.show({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement',
        color: 'red',
      });
      throw err;
    }
  }, [loadReglements]);

  // Supprimer un règlement
  const deleteReglement = useCallback(async (id: number) => {
    try {
      const db = await getDb();
      await db.execute('DELETE FROM reglements WHERE idReglement = ?', [id]);
      
      notifications.show({
        title: 'Succès',
        message: 'Règlement supprimé avec succès',
        color: 'green',
      });
      
      await loadReglements();
    } catch (err) {
      console.error('Erreur suppression règlement:', err);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la suppression',
        color: 'red',
      });
      throw err;
    }
  }, [loadReglements]);

  // Récupérer les règlements d'une facture
  const getReglementsByFacture = useCallback(async (idFacture: number) => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT 
          r.*,
          cl.NomComplet as client_nom
        FROM reglements r
        LEFT JOIN clients cl ON r.idClient = cl.idClient
        WHERE r.idFacture = ?
        ORDER BY r.date_reglement ASC
      `, [idFacture]);
      return result;
    } catch (err) {
      console.error('Erreur récupération règlements facture:', err);
      return [];
    }
  }, []);

  // Récupérer le montant total réglé pour une facture
  const getTotalRegleByFacture = useCallback(async (idFacture: number) => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT COALESCE(SUM(montant), 0) as total
        FROM reglements
        WHERE idFacture = ?
      `, [idFacture]);
      return result[0]?.total || 0;
    } catch (err) {
      console.error('Erreur calcul total réglé:', err);
      return 0;
    }
  }, []);

  useEffect(() => {
    loadReglements();
  }, [loadReglements]);

  return {
    reglements,
    loading,
    error,
    refresh: loadReglements,
    getReglementById,
    createReglement,
    deleteReglement,
    getReglementsByFacture,
    getTotalRegleByFacture,
  };
};

async function getNextReglementCode(): Promise<string> {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `REG-${randomSuffix}`;
}
