// src/hooks/useSales.ts
import { useState, useCallback } from 'react';
import { saleRepository, CreateSaleInput, CreateSaleDetailInput } from '../database/repositories/saleRepository';
import { notifications } from '@mantine/notifications';

export const useSales = () => {
  const [loading, setLoading] = useState(false);
  const [todayStats, setTodayStats] = useState({ total: 0, count: 0 });

  const createSale = useCallback(async (
    sale: CreateSaleInput, 
    details: CreateSaleDetailInput[]
  ) => {
    try {
      setLoading(true);
      const id = await saleRepository.create(sale, details);
      notifications.show({
        title: 'Succès',
        message: 'Vente enregistrée avec succès',
        color: 'green',
      });
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      notifications.show({
        title: 'Erreur',
        message: errorMessage,
        color: 'red',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTodayStats = useCallback(async () => {
    try {
      const stats = await saleRepository.getTodaySales();
      setTodayStats(stats);
      return stats;
    } catch (err) {
      console.error(err);
      return { total: 0, count: 0 };
    }
  }, []);

  const getAllSales = useCallback(async () => {
    try {
      setLoading(true);
      return await saleRepository.getAll();
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getSaleById = useCallback(async (id: number) => {
    try {
      return await saleRepository.getById(id);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  return {
    loading,
    todayStats,
    createSale,
    getTodayStats,
    getAllSales,
    getSaleById,
  };
};