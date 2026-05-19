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

  // Créer un règlement
  const createReglement = useCallback(async (reglement: any) => {
    try {
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
        reglement.code_reglement,
        reglement.idClient,
        reglement.idFacture || null,
        reglement.idVente || null,
        reglement.montant,
        reglement.mode_reglement,
        reglement.reference || null,
        reglement.banque || null,
        reglement.numero_cheque || null,
        reglement.observation || null
      ]);
      
      notifications.show({
        title: 'Succès',
        message: 'Règlement enregistré avec succès',
        color: 'green',
      });
      
      await loadReglements();
      return result.lastInsertId;
    } catch (err) {
      console.error('Erreur création règlement:', err);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'enregistrement',
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
  };
};