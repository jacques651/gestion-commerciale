// src/hooks/useCommandes.ts
import { useState, useEffect, useCallback } from 'react';
import { commandeRepository, Commande, CreateCommandeInput, CreateCommandeDetailInput } from '../database/repositories/commandeRepository';
import { notifications } from '@mantine/notifications';

export const useCommandes = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCommandes = useCallback(async () => {
  try {
    setLoading(true);
    const data = await commandeRepository.getAll();
    setCommandes(data);
    setError(null);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur de chargement des commandes';
    console.error(errorMsg);
    setError(errorMsg);
  } finally {
    setLoading(false);
  }
}, []);


const createCommande = useCallback(async (
  commande: CreateCommandeInput, 
  details: CreateCommandeDetailInput[]
) => {
  try {
    setLoading(true);
    const id = await commandeRepository.create(commande, details);
    notifications.show({
      title: 'Succès',
      message: 'Commande créée avec succès',
      color: 'green',
    });
    await loadCommandes();
    return id;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la création';
    console.error(errorMessage);
    notifications.show({
      title: 'Erreur',
      message: errorMessage,
      color: 'red',
    });
    throw err;
  } finally {
    setLoading(false);
  }
}, [loadCommandes]);

const updateStatus = useCallback(async (id: number, statut: string) => {
  try {
    await commandeRepository.updateStatus(id, statut);
    notifications.show({
      title: 'Succès',
      message: `Statut mis à jour: ${statut}`,
      color: 'green',
    });
    await loadCommandes();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
    console.error(errorMsg);
    notifications.show({
      title: 'Erreur',
      message: errorMsg,
      color: 'red',
    });
    throw err;
  }
}, [loadCommandes]);

const cancelCommande = useCallback(async (id: number) => {
  try {
    await commandeRepository.cancel(id);
    notifications.show({
      title: 'Succès',
      message: 'Commande annulée avec succès. Les stocks ont été restaurés.',
      color: 'orange',
    });
    await loadCommandes();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur lors de l\'annulation';
    console.error(errorMsg);
    notifications.show({
      title: 'Erreur',
      message: errorMsg,
      color: 'red',
    });
    throw err;
  }
}, [loadCommandes]);


// Dans src/hooks/useCommandes.ts
const getCommandeById = useCallback(
  async (id: number) => {
    try {

      return await commandeRepository.getById(id);

    } catch (error) {

      console.error(
        "Erreur getCommandeById:",
        error
      );

      return null;
    }
  },
  []
);

  useEffect(() => {
    loadCommandes();
  }, [loadCommandes]);

  return {
    commandes,
    loading,
    error,
    createCommande,
    updateStatus,
    cancelCommande,
    getCommandeById,
    refresh: loadCommandes,
  };
};