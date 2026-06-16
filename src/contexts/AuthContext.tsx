// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDb } from '../database/db';
import { Utilisateur, AuthContextType, Role } from '../types/auth';
import bcrypt from 'bcryptjs';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Utilisateur | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔧 CRÉER UN ADMIN PAR DÉFAUT SI NÉCESSAIRE
  const createDefaultAdmin = async () => {
    try {
      const db = await getDb();
      
      // Vérifier si la table users existe
      const tables = await db.select<any[]>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='users'
      `);
      
      if (tables.length === 0) {
        console.log("🔧 Création de la table users...");
        await db.execute(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            mot_de_passe TEXT NOT NULL,
            role TEXT DEFAULT 'utilisateur',
            telephone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log("✅ Table users créée");
      }
      
      // Vérifier s'il y a des utilisateurs
      const users = await db.select<any[]>('SELECT COUNT(*) as count FROM users');
      const userCount = users[0]?.count || 0;
      
      if (userCount === 0) {
        console.log("🔧 Aucun utilisateur trouvé, création d'un administrateur par défaut...");
        
        const defaultPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        await db.execute(
          `INSERT INTO users (nom, email, mot_de_passe, role, telephone) 
           VALUES (?, ?, ?, ?, ?)`,
          ['Administrateur', 'admin', hashedPassword, 'admin', '07000000']
        );
        
        console.log("✅ Administrateur par défaut créé");
        console.log("👤 Login: admin");
        console.log("🔑 Mot de passe: admin123");
      }
    } catch (error) {
      console.error("❌ Erreur lors de la création de l'admin par défaut:", error);
    }
  };

  // 🔐 INIT AUTH
  useEffect(() => {
    const initAuth = async () => {
      try {
        await createDefaultAdmin();
        
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
          console.log("✅ User restauré");
        } else {
          console.log("ℹ️ Aucun utilisateur connecté");
        }
      } catch (error) {
        console.error("❌ Auth init error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // 🔐 LOGIN
  const login = async (login: string, password: string): Promise<boolean> => {
    try {
      console.log("🔐 Tentative login pour:", login);

      const db = await getDb();

      // Rechercher par nom ou email
      const users = await db.select<any[]>(
        `SELECT id, nom, email as login, role, telephone, mot_de_passe 
         FROM users 
         WHERE nom = ? OR email = ?`,
        [login, login]
      );

      if (!users || users.length === 0) {
        console.log("❌ Aucun utilisateur trouvé avec ce login");
        return false;
      }

      const userData = users[0];
      console.log("👤 Utilisateur trouvé:", userData.nom);

      // Vérifier le mot de passe
      let isValid = false;
      try {
        isValid = await bcrypt.compare(password, userData.mot_de_passe);
      } catch (e) {
        // Si bcrypt échoue, comparer en clair
        isValid = password === userData.mot_de_passe;
        if (isValid) {
          const hashed = await bcrypt.hash(password, 10);
          await db.execute(`UPDATE users SET mot_de_passe = ? WHERE id = ?`, [hashed, userData.id]);
          console.log("🔑 Mot de passe hashé mis à jour");
        }
      }

      if (!isValid) {
        console.log("❌ Mot de passe incorrect");
        return false;
      }

      // Supprimer le mot de passe avant de stocker
      const { mot_de_passe, ...userWithoutPassword } = userData;

      setUser({
        id: userWithoutPassword.id,
        nom: userWithoutPassword.nom,
        login: userWithoutPassword.login || userWithoutPassword.nom,
        role: userWithoutPassword.role,
        telephone: userWithoutPassword.telephone
      } as unknown as Utilisateur);
      
      localStorage.setItem('user', JSON.stringify(userWithoutPassword));

      console.log("✅ Login réussi pour:", userWithoutPassword.nom);
      return true;

    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    console.log("🔓 Déconnexion réussie");
  };

  // 🔐 REGISTER
  const register = async (nom: string, login: string, password: string, role: Role): Promise<void> => {
    try {
      const db = await getDb();
      
      // Vérifier si le login existe déjà
      const existing = await db.select<any[]>(
        'SELECT id FROM users WHERE nom = ? OR email = ?',
        [nom, login]
      );
      
      if (existing && existing.length > 0) {
        throw new Error('Ce nom d\'utilisateur ou login existe déjà');
      }
      
      const hash = await bcrypt.hash(password, 10);

      await db.execute(
        `INSERT INTO users (nom, email, mot_de_passe, role, telephone) 
         VALUES (?, ?, ?, ?, ?)`,
        [nom, login, hash, role, '']
      );

      console.log("✅ Utilisateur créé:", login);

    } catch (error) {
      console.error("❌ Register error:", error);
      throw error;
    }
  };

  const hasRole = (roles: Role[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};