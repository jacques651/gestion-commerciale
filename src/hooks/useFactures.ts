// src/hooks/useFactures.ts
import { useState, useEffect, useCallback } from 'react';
import { factureRepository, Facture } from '../database/repositories/factureRepository';
import { notifications } from '@mantine/notifications';

export const useFactures = () => {
  const [factures, setFactures] = useState<Facture[]>([]);  // Changé: Facture[] au lieu de FactureWithDetails[]
  const [unpaidInvoices, setUnpaidInvoices] = useState<Facture[]>([]);  // Changé: Facture[] au lieu de FactureWithDetails[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFactures = useCallback(async () => {
    try {
      setLoading(true);
      const data = await factureRepository.getAll();
      setFactures(data);
      setError(null);
    } catch (err) {
      setError('Erreur de chargement des factures');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnpaidInvoices = useCallback(async () => {
    try {
      const data = await factureRepository.getUnpaidInvoices();
      setUnpaidInvoices(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const createFacture = useCallback(async (idCommande: number) => {
    try {
      const id = await factureRepository.createFromCommande(idCommande);
      notifications.show({
        title: 'Succès',
        message: 'Facture créée avec succès',
        color: 'green',
      });
      await loadFactures();
      await loadUnpaidInvoices();
      return id;
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la création de la facture',
        color: 'red',
      });
      throw err;
    }
  }, [loadFactures, loadUnpaidInvoices]);

  const updateStatus = useCallback(async (id: number, statut: Facture['statut']) => {
    try {
      await factureRepository.updateStatus(id, statut);
      notifications.show({
        title: 'Succès',
        message: `Statut mis à jour: ${statut}`,
        color: 'green',
      });
      await loadFactures();
      await loadUnpaidInvoices();
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la mise à jour',
        color: 'red',
      });
      throw err;
    }
  }, [loadFactures, loadUnpaidInvoices]);

  const getFactureById = useCallback(async (id: number) => {
    try {
      return await factureRepository.getById(id);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  useEffect(() => {
    loadFactures();
    loadUnpaidInvoices();
  }, [loadFactures, loadUnpaidInvoices]);

  return {
    factures,
    unpaidInvoices,
    loading,
    error,
    createFacture,
    updateStatus,
    getFactureById,
    refresh: loadFactures,
  };
};