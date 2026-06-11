// src/services/TransactionService.ts

import { getDb } from "../database/db";

export async function executeTransaction(
  callback: (db: any) => Promise<any>
) {

  const db = await getDb();

  try {

    await db.execute("BEGIN TRANSACTION");

    const result = await callback(db);

    await db.execute("COMMIT");

    return result;

  } catch (error) {

    await db.execute("ROLLBACK");

    throw error;
  }
}