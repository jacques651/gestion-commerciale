// src/database/repositories/categorieRepository.ts
import { getDb } from '../db';

export interface Categorie {
  idCategorie: number;
  code_categorie: string;
  nom_categorie: string;
  description?: string;
  parent_id?: number;
  niveau: number;
  chemin?: string;
  image_url?: string;
  est_active: number;
  ordre_affichage: number;
}

export interface CreateCategorieInput {
  code_categorie: string;
  nom_categorie: string;
  description?: string;
  parent_id?: number;
  niveau?: number;
  image_url?: string;
  ordre_affichage?: number;
}

class CategorieRepository {
  async getAll(): Promise<Categorie[]> {
    const db = await getDb();
    return await db.select<Categorie[]>(
      `SELECT * FROM categories WHERE est_active = 1 ORDER BY nom_categorie ASC`
    );
  }

  async getById(id: number): Promise<Categorie | null> {
    const db = await getDb();
    const result = await db.select<Categorie[]>(
      'SELECT * FROM categories WHERE idCategorie = ?',
      [id]
    );
    return result.length > 0 ? result[0] : null;
  }

  async create(data: CreateCategorieInput): Promise<number> {
    const db = await getDb();
    const result = await db.execute(
      `INSERT INTO categories (
        code_categorie, nom_categorie, description, parent_id,
        niveau, image_url, ordre_affichage, est_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        data.code_categorie,
        data.nom_categorie,
        data.description || null,
        data.parent_id || null,
        data.niveau || 0,
        data.image_url || null,
        data.ordre_affichage || 0
      ]
    );
    return Number(result.lastInsertId);
  }

  async update(id: number, data: Partial<CreateCategorieInput>): Promise<void> {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['nom_categorie', 'description', 'parent_id', 'niveau', 'image_url', 'ordre_affichage', 'est_active'];
    for (const key of allowedFields) {
      if (data[key as keyof CreateCategorieInput] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key as keyof CreateCategorieInput]);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    await db.execute(
      `UPDATE categories SET ${fields.join(', ')} WHERE idCategorie = ?`,
      values
    );
  }

  async delete(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(
      'UPDATE categories SET est_active = 0 WHERE idCategorie = ?',
      [id]
    );
  }

  async getByNom(nom: string): Promise<Categorie | null> {
    const db = await getDb();
    const result = await db.select<Categorie[]>(
      'SELECT * FROM categories WHERE nom_categorie LIKE ? AND est_active = 1',
      [`%${nom}%`]
    );
    return result.length > 0 ? result[0] : null;
  }
}

export const categorieRepository = new CategorieRepository();