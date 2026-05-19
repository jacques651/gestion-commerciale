// src/hooks/useProducts.ts
import { useState, useEffect, useCallback } from 'react';
import { productRepository, Product, CreateProductInput } from '../database/repositories/productRepository';
import { notifications } from '@mantine/notifications';

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await productRepository.getAll();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError('Erreur de chargement des produits');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProduct = useCallback(async (product: CreateProductInput) => {
    try {
      const id = await productRepository.create(product);
      notifications.show({
        title: 'Succès',
        message: 'Produit créé avec succès',
        color: 'green',
      });
      await loadProducts();
      return id;
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la création du produit',
        color: 'red',
      });
      throw err;
    }
  }, [loadProducts]);

  const updateProduct = useCallback(async (id: number, product: Partial<Product>) => {
    try {
      await productRepository.update(id, product);
      notifications.show({
        title: 'Succès',
        message: 'Produit modifié avec succès',
        color: 'green',
      });
      await loadProducts();
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la modification',
        color: 'red',
      });
      throw err;
    }
  }, [loadProducts]);

  const updateStock = useCallback(async (id: number, quantity: number) => {
    try {
      await productRepository.updateStock(id, quantity);
      await loadProducts();
    } catch (err) {
      console.error('Erreur stock:', err);
      throw err;
    }
  }, [loadProducts]);

  const deleteProduct = useCallback(async (id: number) => {
    try {
      await productRepository.delete(id);
      notifications.show({
        title: 'Succès',
        message: 'Produit supprimé avec succès',
        color: 'green',
      });
      await loadProducts();
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la suppression',
        color: 'red',
      });
      throw err;
    }
  }, [loadProducts]);

  const searchProducts = useCallback(async (term: string) => {
    if (!term) {
      await loadProducts();
      return;
    }
    try {
      setLoading(true);
      const results = await productRepository.search(term);
      setProducts(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadProducts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    products,
    loading,
    error,
    createProduct,
    updateProduct,
    updateStock,
    deleteProduct,
    searchProducts,
    refresh: loadProducts,
  };
};