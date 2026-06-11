// services/FactureService.ts

import { getDb }
from "../database/db";
import { CreateFactureDto } from "../types/Facture";

export default class FactureService {

  static async createFacture(
    dto: CreateFactureDto
  ) {

    const db =
      await getDb();

    const codeFacture =
      `FAC-${Date.now()}`;

    await db.execute(
      `
      INSERT INTO factures
      (
        code_facture,
        idClient,
        idCommande,
        montant_ht,
        montant_ttc
      )
      VALUES
      (
        ?,?,?,?,?
      )
      `,
      [
        codeFacture,
        dto.idClient,
        dto.idCommande ?? null,
        dto.montantHT,
        dto.montantTTC
      ]
    );

    const result =
      await db.select<any[]>(
        `
        SELECT last_insert_rowid()
        AS id
        `
      );

    return result[0].id;
  }

  static async payerFacture(
    idFacture: number,
    montant: number,
    modePaiement: string
  ) {

    const db =
      await getDb();

    await db.execute(
      `
      INSERT INTO reglements
      (
        idFacture,
        montant,
        mode_reglement
      )
      VALUES
      (
        ?,?,?
      )
      `,
      [
        idFacture,
        montant,
        modePaiement
      ]
    );

    await db.execute(
      `
      UPDATE factures
      SET montant_regle =
      montant_regle + ?
      WHERE idFacture = ?
      `,
      [
        montant,
        idFacture
      ]
    );
  }
}