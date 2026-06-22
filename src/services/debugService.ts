// src/services/debugService.ts

import { getDb } from '../database/db';

export interface DebugLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  category: string;
  message: string;
  details?: any;
  stack?: string;
  userId?: string;
}

export interface SystemInfo {
  appVersion: string;
  dbVersion: number;
  tablesCount: number;
  totalRecords: number;
  lastBackup: string | null;
  dbPath: string;
  platform: string;
  memoryUsage: string;
  uptime: number;
}

class DebugService {
  private logs: DebugLog[] = [];
  private maxLogs = 1000;
  private listeners: ((logs: DebugLog[]) => void)[] = [];
  private forceLogging = true;
  private isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  private isLogging = false; // ✅ Flag pour éviter les boucles infinies

  constructor() {
    try {
      const saved = localStorage.getItem('debug_logs');
      if (saved) {
        this.logs = JSON.parse(saved).slice(0, this.maxLogs);
      }
    } catch (e) {
      // Utiliser console.log directement pour éviter la boucle
      console.log('Impossible de charger les logs de débogage');
    }

    if (this.isDevelopment) {
      this.forceLogging = true;
      console.log('🔍 Mode développement - Débogage activé');
    }

    this.setupGlobalErrorHandler();
  }

  private setupGlobalErrorHandler(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        // ✅ Utiliser un setTimeout pour éviter la boucle
        setTimeout(() => {
          this.error(
            'Global',
            `Erreur non catchée: ${event.message}`,
            event.error,
            {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno
            }
          );
        }, 0);
      });

      window.addEventListener('unhandledrejection', (event) => {
        setTimeout(() => {
          this.error(
            'Global',
            `Promesse rejetée: ${event.reason?.message || event.reason}`,
            event.reason,
            { promise: event.promise }
          );
        }, 0);
      });

  
    }
  }

  private getTimeStr(): string {
    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      return `${hours}:${minutes}:${seconds}.${ms}`;
    } catch (error) {
      return '00:00:00.000';
    }
  }

  log(
    level: DebugLog['level'],
    category: string,
    message: string,
    details?: any,
    error?: Error
  ): void {
    // ✅ Éviter les appels récursifs
    if (this.isLogging) {
      return;
    }

    this.isLogging = true;

    try {
      const timestamp = new Date().toISOString();
      const timeStr = this.getTimeStr();

      const style = level === 'error' ? 'color: #F44336; font-weight: bold;' :
                    level === 'warning' ? 'color: #FF9800; font-weight: bold;' :
                    level === 'info' ? 'color: #2196F3; font-weight: bold;' :
                    'color: #9E9E9E; font-weight: bold;';

      const prefix = `[${level.toUpperCase()}] ${category}:`;

      if (this.forceLogging || this.isDevelopment) {
        if (level === 'error') {
          console.error(`%c[${timeStr}] ${prefix} ${message}`, style, details || '');
          if (error?.stack) {
            console.error('Stack trace:', error.stack);
          }
        } else if (level === 'warning') {
          console.warn(`%c[${timeStr}] ${prefix} ${message}`, style, details || '');
        } else if (level === 'info') {
          console.info(`%c[${timeStr}] ${prefix} ${message}`, style, details || '');
        } else {
          console.debug(`%c[${timeStr}] ${prefix} ${message}`, style, details || '');
        }
      }

      const log: DebugLog = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 6),
        timestamp,
        level,
        category,
        message,
        details,
        stack: error?.stack,
      };

      this.logs.unshift(log);
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(0, this.maxLogs);
      }

      try {
        localStorage.setItem('debug_logs', JSON.stringify(this.logs));
      } catch (e) {}

      this.listeners.forEach(listener => listener(this.logs));

    } catch (e) {
      // ✅ En cas d'erreur, utiliser console.log directement
      console.log('Erreur dans DebugService.log:', e);
    } finally {
      this.isLogging = false;
    }
  }

  info(category: string, message: string, details?: any): void {
    this.log('info', category, message, details);
  }

  warn(category: string, message: string, details?: any): void {
    this.log('warning', category, message, details);
  }

  error(category: string, message: string, error?: Error, details?: any): void {
    this.log('error', category, message, { ...details, error: error?.message }, error);
  }

  debug(category: string, message: string, details?: any): void {
    this.log('debug', category, message, details);
  }

  setLoggingEnabled(enabled: boolean): void {
    this.forceLogging = enabled;
    console.log(`🔍 Débogage ${enabled ? 'activé' : 'désactivé'}`);
    if (enabled) {
      console.log(`📊 ${this.logs.length} logs disponibles`);
    }
  }

  getLogs(filters?: {
    level?: DebugLog['level'];
    category?: string;
    search?: string;
    limit?: number;
  }): DebugLog[] {
    let filtered = this.logs;

    if (filters?.level) {
      filtered = filtered.filter(l => l.level === filters.level);
    }

    if (filters?.category) {
      filtered = filtered.filter(l => l.category === filters.category);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(l =>
        l.message.toLowerCase().includes(search) ||
        l.category.toLowerCase().includes(search)
      );
    }

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  clearLogs(): void {
    this.logs = [];
    localStorage.removeItem('debug_logs');
    this.listeners.forEach(listener => listener(this.logs));
    console.log('🗑️ Logs de débogage supprimés');
  }

  subscribe(listener: (logs: DebugLog[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  async getSystemInfo(): Promise<SystemInfo> {
    try {
      const db = await getDb();
      
      let dbVersion = 0;
      try {
        const versionResult = await db.select(`
          SELECT version FROM database_version WHERE id = 1
        `);
        if ((versionResult as any[]).length > 0) {
          dbVersion = (versionResult as any[])[0].version;
        }
      } catch (e) {}

      const tables = await db.select(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      const tablesCount = (tables as any[]).length;

      let totalRecords = 0;
      for (const table of (tables as any[])) {
        try {
          const count = await db.select(`SELECT COUNT(*) as count FROM ${table.name}`);
          totalRecords += (count as any[])[0]?.count || 0;
        } catch (e) {}
      }

      let lastBackup: string | null = null;
      try {
        const backups = JSON.parse(localStorage.getItem('backup_list') || '[]');
        if (backups.length > 0) {
          lastBackup = backups[backups.length - 1].timestamp;
        }
      } catch (e) {}

      const memory = (performance as any).memory;
      const memoryUsage = memory ? 
        `${Math.round(memory.usedJSHeapSize / 1024 / 1024)} MB / ${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)} MB` :
        'Non disponible';

      return {
        appVersion: '3.0.0',
        dbVersion,
        tablesCount,
        totalRecords,
        lastBackup,
        dbPath: 'sqlite:gestion-commerciale.db',
        platform: navigator.platform,
        memoryUsage,
        uptime: Math.round(performance.now() / 60000),
      };
    } catch (error) {
      console.error('Erreur récupération info système:', error);
      return {
        appVersion: '3.0.0',
        dbVersion: 0,
        tablesCount: 0,
        totalRecords: 0,
        lastBackup: null,
        dbPath: 'Inconnu',
        platform: navigator.platform,
        memoryUsage: 'Non disponible',
        uptime: 0,
      };
    }
  }

  async debugFunction<T>(
    name: string,
    fn: () => Promise<T>,
    context?: any
  ): Promise<T> {
    const startTime = performance.now();
    const timeStr = this.getTimeStr();
    
    console.log(`%c[${timeStr}] 🔬 DEBUG: Début de ${name}`, 'color: #9C27B0; font-weight: bold;', context || '');
    
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - startTime);
      console.log(`%c[${timeStr}] ✅ DEBUG: ${name} terminé en ${duration}ms`, 'color: #4CAF50; font-weight: bold;', { result, duration });
      this.info('debugFunction', `${name} terminé en ${duration}ms`, { result, duration });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      console.error(`%c[${timeStr}] ❌ DEBUG: ${name} échoué en ${duration}ms`, 'color: #F44336; font-weight: bold;', error);
      this.error('debugFunction', `${name} échoué en ${duration}ms`, error as Error, { duration });
      throw error;
    }
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  downloadLogs(): void {
    const json = this.exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_logs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('📥 Logs téléchargés');
  }

  getLogStats(): { total: number; levels: Record<string, number>; categories: Record<string, number> } {
    const levels: Record<string, number> = {};
    const categories: Record<string, number> = {};

    for (const log of this.logs) {
      levels[log.level] = (levels[log.level] || 0) + 1;
      categories[log.category] = (categories[log.category] || 0) + 1;
    }

    return {
      total: this.logs.length,
      levels,
      categories
    };
  }
}

export const debugService = new DebugService();

// Hook pour utiliser le service de débogage
export const useDebug = (componentName: string) => {
  const getTimeStr = (): string => {
    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      return `${hours}:${minutes}:${seconds}.${ms}`;
    } catch {
      return '00:00:00.000';
    }
  };

  const logInfo = (message: string, details?: any) => {
    console.log(`%c[${getTimeStr()}] ℹ️ ${componentName}: ${message}`, 
      'color: #2196F3; font-weight: bold;', 
      details || ''
    );
    debugService.info(componentName, message, details);
  };

  const logWarning = (message: string, details?: any) => {
    console.warn(`%c[${getTimeStr()}] ⚠️ ${componentName}: ${message}`, 
      'color: #FF9800; font-weight: bold;', 
      details || ''
    );
    debugService.warn(componentName, message, details);
  };

  const logError = (message: string, error?: Error, details?: any) => {
    console.error(`%c[${getTimeStr()}] ❌ ${componentName}: ${message}`, 
      'color: #F44336; font-weight: bold;', 
      error || details || ''
    );
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    debugService.error(componentName, message, error, details);
  };

  const logDebug = (message: string, details?: any) => {
    console.debug(`%c[${getTimeStr()}] 🔍 ${componentName}: ${message}`, 
      'color: #9E9E9E; font-weight: bold;', 
      details || ''
    );
    debugService.debug(componentName, message, details);
  };

  const logAction = (action: string, data?: any) => {
    console.log(`%c[${getTimeStr()}] 🎯 ${componentName}: Action: ${action}`, 
      'color: #9C27B0; font-weight: bold;', 
      data || ''
    );
    debugService.debug(componentName, `Action: ${action}`, data);
  };

  const logApiCall = async <T,>(
    name: string,
    fn: () => Promise<T>,
    context?: any
  ): Promise<T> => {
    const startTime = performance.now();
    console.log(`%c[${getTimeStr()}] 🌐 ${componentName}: Appel API: ${name}`, 
      'color: #00BCD4; font-weight: bold;', 
      context || ''
    );
    
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - startTime);
      console.log(`%c[${getTimeStr()}] ✅ ${componentName}: API ${name} terminé en ${duration}ms`, 
        'color: #4CAF50; font-weight: bold;', 
        result
      );
      debugService.info(componentName, `API ${name} terminé en ${duration}ms`, { result, duration });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      console.error(`%c[${getTimeStr()}] ❌ ${componentName}: API ${name} échoué après ${duration}ms`, 
        'color: #F44336; font-weight: bold;', 
        error
      );
      debugService.error(componentName, `API ${name} échoué`, error as Error, { duration });
      throw error;
    }
  };

  const logRender = (props?: any) => {
    console.debug(`%c[${getTimeStr()}] 🔄 ${componentName}: Render`, 
      'color: #8BC34A; font-weight: bold;', 
      props || ''
    );
    debugService.debug(componentName, 'Render', { props });
  };

  const logMount = () => {
    console.log(`%c[${getTimeStr()}] 📦 ${componentName}: Component mounted`, 
      'color: #4CAF50; font-weight: bold;'
    );
    debugService.info(componentName, 'Component mounted');
  };

  const logUnmount = () => {
    console.log(`%c[${getTimeStr()}] 📦 ${componentName}: Component unmounted`, 
      'color: #FF5722; font-weight: bold;'
    );
    debugService.info(componentName, 'Component unmounted');
  };

  const logStateChange = (stateName: string, oldValue: any, newValue: any) => {
    console.debug(`%c[${getTimeStr()}] 🔄 ${componentName}: State: ${stateName}`, 
      'color: #FF6F00; font-weight: bold;', 
      { oldValue, newValue }
    );
    debugService.debug(componentName, `State change: ${stateName}`, { oldValue, newValue });
  };

  return {
    logInfo,
    logWarning,
    logError,
    logDebug,
    logAction,
    logApiCall,
    logRender,
    logMount,
    logUnmount,
    logStateChange,
    debugService,
  };
};

export default debugService;