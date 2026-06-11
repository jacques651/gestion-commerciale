// src/hooks/useDecomptes.ts

import {
  useState,
  useEffect,
  useCallback
} from "react";

import {
  notifications
} from "@mantine/notifications";

import {
  decompteRepository,
  CreateDecompteInput,
  CreateDecompteDetailInput
} from "../database/repositories/decompteRepository";

export const useDecomptes = () => {

  const [decomptes, setDecomptes] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  /**
   * Charger tous les décomptes
   */
  const loadDecomptes =
    useCallback(async () => {

      try {

        setLoading(true);

        const data =
          await decompteRepository
            .getAll();

        setDecomptes(data);

        setError(null);

      } catch (err) {

        const errorMsg =
          err instanceof Error
            ? err.message
            : "Erreur de chargement";

        console.error(errorMsg);

        setError(errorMsg);

      } finally {

        setLoading(false);

      }

    }, []);

  /**
   * Créer un décompte
   */
  const createDecompte =
    useCallback(async (
      decompte: CreateDecompteInput,
      details: CreateDecompteDetailInput[]
    ) => {

      try {

        setLoading(true);

        const id =
          await decompteRepository
            .create(
              decompte,
              details
            );

        notifications.show({
          title: "Succès",
          message:
            "Décompte enregistré avec succès",
          color: "green"
        });

        await loadDecomptes();

        return id;

      } catch (err) {

        const errorMsg =
          err instanceof Error
            ? err.message
            : "Erreur création décompte";

        notifications.show({
          title: "Erreur",
          message: errorMsg,
          color: "red"
        });

        throw err;

      } finally {

        setLoading(false);

      }

    }, [loadDecomptes]);

  /**
   * Obtenir un décompte
   */
  const getDecompteById =
    useCallback(async (
      idDecompte: number
    ) => {

      try {

        return await
          decompteRepository
            .getById(
              idDecompte
            );

      } catch (error) {

        console.error(
          "Erreur chargement décompte",
          error
        );

        return null;

      }

    }, []);

  /**
   * Supprimer
   */
  const deleteDecompte =
    useCallback(async (
      idDecompte: number
    ) => {

      try {

        setLoading(true);

        await decompteRepository
          .delete(
            idDecompte
          );

        notifications.show({
          title: "Succès",
          message:
            "Décompte supprimé",
          color: "green"
        });

        await loadDecomptes();

      } catch (err) {

        const errorMsg =
          err instanceof Error
            ? err.message
            : "Erreur suppression";

        notifications.show({
          title: "Erreur",
          message: errorMsg,
          color: "red"
        });

        throw err;

      } finally {

        setLoading(false);

      }

    }, [loadDecomptes]);

  const updateStatut =
    useCallback(async (
      idDecompte: number,
      statut: string
    ) => {

      try {

        await decompteRepository
          .updateStatut(
            idDecompte,
            statut
          );

        await loadDecomptes();

      } catch (error) {

        console.error(error);

        throw error;
      }

    }, [loadDecomptes]);

  const rechercher =
    useCallback(async (
      texte: string
    ) => {

      try {

        setLoading(true);

        const result =
          await decompteRepository
            .rechercher(
              texte
            );

        setDecomptes(result);

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);

      }

    }, []);

  /**
   * Rafraîchir
   */
  const refresh =
    useCallback(async () => {

      await loadDecomptes();

    }, [loadDecomptes]);

  useEffect(() => {

    loadDecomptes();

  }, [loadDecomptes]);

  return {

    decomptes,

    loading,

    error,

    createDecompte,

    getDecompteById,

    deleteDecompte,

    updateStatut,

    rechercher,

    refresh

  };

};