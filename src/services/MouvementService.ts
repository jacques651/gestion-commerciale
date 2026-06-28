// src/services/MouvementService.ts

import { getDb } from "../database/db";

export interface MouvementStockDto {

  idProduit: number;

  typeMouvement:
    | "ENTREE"
    | "SORTIE"
    | "CORRECTION";

  quantite: number;

  stockAvant: number;

  stockApres: number;

  documentType?: string;

  documentId?: number;

  reference?: string;

  motif?: string;
}

export default class MouvementService {

  static async create(
    dto: MouvementStockDto
  ): Promise<void> {

    const db = await getDb();

    await db.execute(
      `
      INSERT INTO mouvements_stock
      (
        idProduit,
        type_mouvement,
        quantite,
        stock_avant,
        stock_apres,
        reference,
        notes,
        date_mouvement
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        dto.idProduit,
        dto.typeMouvement,
        dto.quantite,
        dto.stockAvant,
        dto.stockApres,
        dto.reference ?? null,
        dto.motif ?? null,
        new Date().toISOString()
      ]
    );
  }
}