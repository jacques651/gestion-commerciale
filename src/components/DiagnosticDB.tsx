// src/components/DiagnosticDB.tsx
import React, { useState, useEffect } from 'react';
import { getDb } from '../database/db';

// Définir les interfaces pour les types
interface TableInfo {
  name: string;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export const DiagnosticDB: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const db = await getDb();
        
        // Lister toutes les tables
        const tableList = await db.select<TableInfo[]>(`
          SELECT name FROM sqlite_master 
          WHERE type='table' 
          ORDER BY name
        `);
        setTables(tableList.map((t: TableInfo) => t.name));
        
        // Voir les colonnes de products
        const productColumns = await db.select<ColumnInfo[]>(`
          PRAGMA table_info(products)
        `);
        setColumns(productColumns);
        
      } catch (err) {
        console.error('Erreur:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };
    
    checkDatabase();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Erreur</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">État de la base de données</h2>
      
      <div className="mb-6">
        <h3 className="font-semibold mb-2 text-gray-700">Tables existantes :</h3>
        <div className="flex flex-wrap gap-2">
          {tables.map(table => (
            <span key={table} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
              {table}
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-2">Total: {tables.length} tables</p>
      </div>
      
      <div>
        <h3 className="font-semibold mb-2 text-gray-700">Colonnes de la table "products" :</h3>
        <div className="bg-gray-50 p-3 rounded-lg text-sm border">
          {columns.map(col => (
            <div key={col.cid} className="mb-2 pb-2 border-b border-gray-200 last:border-0">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-blue-700">{col.name}</span>
                <span className="text-gray-500 text-xs">{col.type}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {col.notnull === 1 && <span className="mr-2">🔒 NOT NULL</span>}
                {col.pk === 1 && <span className="mr-2">🔑 PRIMARY KEY</span>}
                {col.dflt_value && <span>📌 DEFAULT: {col.dflt_value}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};