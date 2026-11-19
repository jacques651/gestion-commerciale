// src/hooks/useClients.ts
import { useState, useEffect, useCallback } from 'react';
import { clientRepository, Client, CreateClientInput } from '../database/repositories/clientRepository';
import { notifications } from '@mantine/notifications';

export const useClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clientRepository.getAll();
      console.log('📋 Clients chargés:', data.length);
      setClients(data);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement:', err);
      setError('Erreur de chargement des clients');
    } finally {
      setLoading(false);
    }
  }, []);

  const createClient = useCallback(async (client: CreateClientInput) => {
    try {
      const id = await clientRepository.create(client);
      notifications.show({
        title: 'Succès',
        message: 'Client créé avec succès',
        color: 'green',
      });
      await loadClients();
      return id;
    } catch (err) {
      console.error(err);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la création du client',
        color: 'red',
      });
      throw err;
    }
  }, [loadClients]);

  const updateClient = useCallback(async (id: number, client: Partial<CreateClientInput>) => {
    try {
      await clientRepository.update(id, client);
      notifications.show({
        title: 'Succès',
        message: 'Client modifié avec succès',
        color: 'green',
      });
      await loadClients();
    } catch (err) {
      console.error(err);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la modification',
        color: 'red',
      });
      throw err;
    }
  }, [loadClients]);

  const deleteClient = useCallback(async (id: number) => {
    try {
      await clientRepository.delete(id);
      notifications.show({
        title: 'Succès',
        message: 'Client supprimé avec succès',
        color: 'green',
      });
      await loadClients();
    } catch (err) {
      console.error(err);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la suppression',
        color: 'red',
      });
      throw err;
    }
  }, [loadClients]);

  const annulerClient = useCallback(async (id: number, par?: string) => {
    try {
      await clientRepository.annuler(id, par);
      notifications.show({ title: 'Client annulé', message: 'Client annulé (conservé et exclu des sélections)', color: 'orange' });
      await loadClients();
    } catch (err) {
      console.error(err);
      notifications.show({ title: 'Erreur', message: "Erreur lors de l'annulation", color: 'red' });
      throw err;
    }
  }, [loadClients]);

  const restaurerClient = useCallback(async (id: number) => {
    try {
      await clientRepository.restaurer(id);
      notifications.show({ title: 'Client rétabli', message: 'Client rétabli', color: 'green' });
      await loadClients();
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [loadClients]);

  const searchClients = useCallback(async (term: string) => {
    if (!term) {
      await loadClients();
      return;
    }
    try {
      setLoading(true);
      const results = await clientRepository.search(term);
      setClients(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadClients]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  return {
    clients,
    loading,
    error,
    createClient,
    updateClient,
    deleteClient,
    annulerClient,
    restaurerClient,
    searchClients,
    refresh: loadClients,
  };
};