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
        code_mouvement,
        idProduit,
        type_mouvement,
        quantite,
        stock_avant,
        stock_apres,
        document_type,
        document_id,
        reference,
        motif
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
      `,
      [
        `MVT-${Date.now()}`,
        dto.idProduit,
        dto.typeMouvement,
        dto.quantite,
        dto.stockAvant,
        dto.stockApres,
        dto.documentType ?? null,
        dto.documentId ?? null,
        dto.reference ?? null,
        dto.motif ?? null
      ]
    );
  }
}