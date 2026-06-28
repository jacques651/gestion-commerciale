// src/services/debugService.ts
// Système de débogage production : persist dans SQLite + intercept console.*

import { getDb } from '../database/db';

export interface DebugLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  category: string;
  message: string;
  details?: any;
  stack?: string;
  app_version?: string;
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

const APP_VERSION = '3.0.0';
const MAX_DB_LOGS = 2000;
const MAX_MEM_LOGS = 500;

class DebugService {
  private memLogs: DebugLog[] = [];
  private listeners: ((logs: DebugLog[]) => void)[] = [];
  private isLogging = false;
  private dbReady = false;
  private pendingLogs: DebugLog[] = [];
  private consolesPatched = false;

  constructor() {
    try {
      const saved = localStorage.getItem('debug_logs_cache');
      if (saved) this.memLogs = JSON.parse(saved).slice(0, MAX_MEM_LOGS);
    } catch (_) {}

    this.setupGlobalErrorHandler();
    this.interceptConsoleMethods();
    this.initDb();
  }

  private async initDb(): Promise<void> {
    try {
      const db = await getDb();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS debug_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT,
          stack TEXT,
          app_version TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const rows = await db.select<any[]>(
        `SELECT * FROM debug_logs ORDER BY timestamp DESC LIMIT ?`,
        [MAX_MEM_LOGS]
      );
      this.memLogs = rows.map(r => ({
        id: String(r.id),
        timestamp: r.timestamp,
        level: r.level,
        category: r.category,
        message: r.message,
        details: r.details ? this.tryParse(r.details) : undefined,
        stack: r.stack,
        app_version: r.app_version,
      }));

      this.dbReady = true;
      this.notifyListeners();

      for (const log of this.pendingLogs) await this.persistToDb(log);
      this.pendingLogs = [];

      await db.execute(
        `DELETE FROM debug_logs WHERE id NOT IN (
          SELECT id FROM debug_logs ORDER BY timestamp DESC LIMIT ?
        )`,
        [MAX_DB_LOGS]
      );
    } catch (_) {}
  }

  private tryParse(val: string): any {
    try { return JSON.parse(val); } catch { return val; }
  }

  private async persistToDb(log: DebugLog): Promise<void> {
    try {
      const db = await getDb();
      await db.execute(
        `INSERT INTO debug_logs (timestamp, level, category, message, details, stack, app_version)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          log.timestamp,
          log.level,
          log.category,
          log.message,
          log.details !== undefined ? JSON.stringify(log.details) : null,
          log.stack || null,
          APP_VERSION,
        ]
      );
    } catch (_) {}
  }

  // ─── Interception console.* ────────────────────────────────────────────────
  private interceptConsoleMethods(): void {
    if (this.consolesPatched || typeof window === 'undefined') return;
    this.consolesPatched = true;

    const orig = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    const self = this;

    console.log = function (...a: any[]) { orig.log(...a); self.captureConsole('debug', 'console.log', a); };
    console.info = function (...a: any[]) { orig.info(...a); self.captureConsole('info', 'console.info', a); };
    console.warn = function (...a: any[]) { orig.warn(...a); self.captureConsole('warning', 'console.warn', a); };
    console.error = function (...a: any[]) { orig.error(...a); self.captureConsole('error', 'console.error', a); };
    console.debug = function (...a: any[]) { orig.debug(...a); self.captureConsole('debug', 'console.debug', a); };
  }

  private captureConsole(level: DebugLog['level'], category: string, args: any[]): void {
    if (this.isLogging) return;
    let message = '';
    let details: any;
    let stack: string | undefined;

    for (const arg of args) {
      if (arg instanceof Error) {
        message = message || arg.message;
        stack = arg.stack;
      } else if (typeof arg === 'string') {
        // Ignorer les strings de style CSS
        if (arg.startsWith('%c') || /^(color:|font-weight:|background-)/.test(arg)) continue;
        // Ignorer si c'est un format string avec %c
        if (message === '' && arg.includes('%c')) {
          message = arg.replace(/%c/g, '').trim();
          continue;
        }
        message = message ? `${message} | ${arg}` : arg;
      } else if (arg !== null && arg !== undefined && typeof arg === 'object') {
        details = arg;
      }
    }

    if (!message && details) {
      try { message = JSON.stringify(details).substring(0, 300); } catch { message = '[objet]'; }
      details = undefined;
    }

    if (!message) return;

    // Limiter les catégories trop verbeuses en debug
    if (level === 'debug' && (
      category === 'console.log' || category === 'console.debug'
    ) && message.length < 5) return;

    this.addLog(level, category, message, details, stack);
  }

  // ─── Erreurs globales ──────────────────────────────────────────────────────
  private setupGlobalErrorHandler(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (ev) => {
      setTimeout(() => {
        this.addLog('error', 'Erreur globale',
          ev.message || 'Erreur JavaScript',
          { fichier: ev.filename, ligne: ev.lineno, colonne: ev.colno },
          ev.error?.stack
        );
      }, 0);
    });

    window.addEventListener('unhandledrejection', (ev) => {
      setTimeout(() => {
        const r = ev.reason;
        this.addLog('error', 'Promesse rejetée',
          r?.message || String(r) || 'Erreur inconnue',
          undefined,
          r?.stack
        );
      }, 0);
    });
  }

  // ─── Méthode centrale ─────────────────────────────────────────────────────
  private addLog(
    level: DebugLog['level'],
    category: string,
    message: string,
    details?: any,
    stack?: string
  ): void {
    if (this.isLogging) return;
    this.isLogging = true;
    try {
      const log: DebugLog = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
        details,
        stack,
        app_version: APP_VERSION,
      };

      this.memLogs.unshift(log);
      if (this.memLogs.length > MAX_MEM_LOGS) this.memLogs = this.memLogs.slice(0, MAX_MEM_LOGS);

      try {
        localStorage.setItem('debug_logs_cache', JSON.stringify(this.memLogs.slice(0, 100)));
      } catch (_) {}

      if (this.dbReady) this.persistToDb(log);
      else this.pendingLogs.push(log);

      this.notifyListeners();
    } finally {
      this.isLogging = false;
    }
  }

  private notifyListeners(): void {
    for (const l of this.listeners) { try { l(this.memLogs); } catch (_) {} }
  }

  // ─── API publique ──────────────────────────────────────────────────────────
  info(category: string, message: string, details?: any): void {
    this.addLog('info', category, message, details);
  }

  warn(category: string, message: string, details?: any): void {
    this.addLog('warning', category, message, details);
  }

  error(category: string, message: string, error?: Error | any, details?: any): void {
    this.addLog('error', category, message,
      { ...details, erreur: error?.message || String(error) },
      error?.stack
    );
  }

  debug(category: string, message: string, details?: any): void {
    this.addLog('debug', category, message, details);
  }

  getLogs(filters?: {
    level?: DebugLog['level'];
    category?: string;
    search?: string;
    limit?: number;
  }): DebugLog[] {
    let result = this.memLogs;
    if (filters?.level) result = result.filter(l => l.level === filters.level);
    if (filters?.category) result = result.filter(l => l.category === filters.category);
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(l =>
        l.message.toLowerCase().includes(s) || l.category.toLowerCase().includes(s)
      );
    }
    if (filters?.limit) result = result.slice(0, filters.limit);
    return result;
  }

  subscribe(listener: (logs: DebugLog[]) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  async clearLogs(): Promise<void> {
    this.memLogs = [];
    localStorage.removeItem('debug_logs_cache');
    try {
      const db = await getDb();
      await db.execute('DELETE FROM debug_logs');
    } catch (_) {}
    this.notifyListeners();
  }

  async reloadFromDb(): Promise<void> {
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(
        `SELECT * FROM debug_logs ORDER BY timestamp DESC LIMIT ?`,
        [MAX_MEM_LOGS]
      );
      this.memLogs = rows.map(r => ({
        id: String(r.id),
        timestamp: r.timestamp,
        level: r.level,
        category: r.category,
        message: r.message,
        details: r.details ? this.tryParse(r.details) : undefined,
        stack: r.stack,
        app_version: r.app_version,
      }));
      this.notifyListeners();
    } catch (_) {}
  }

  // ─── Export ────────────────────────────────────────────────────────────────
  async exportAsText(): Promise<string> {
    let logs = this.memLogs;
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(
        `SELECT * FROM debug_logs ORDER BY timestamp DESC LIMIT ?`,
        [MAX_DB_LOGS]
      );
      logs = rows.map(r => ({
        id: String(r.id),
        timestamp: r.timestamp,
        level: r.level,
        category: r.category,
        message: r.message,
        details: r.details ? this.tryParse(r.details) : undefined,
        stack: r.stack,
      }));
    } catch (_) {}

    const lines = [
      `=== RAPPORT DE DÉBOGAGE ===`,
      `Application : Gestion Commerciale Pro v${APP_VERSION}`,
      `Exporté le  : ${new Date().toLocaleString('fr-FR')}`,
      `Plateforme  : ${navigator.platform}`,
      `Total logs  : ${logs.length}`,
      ``,
      `${'─'.repeat(80)}`,
      ``,
    ];

    for (const log of logs) {
      const date = new Date(log.timestamp).toLocaleString('fr-FR');
      const lvl = log.level.toUpperCase().padEnd(7);
      lines.push(`[${date}] ${lvl} [${log.category}] ${log.message}`);
      if (log.details) {
        const det = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
        lines.push(`  → Détails : ${det}`);
      }
      if (log.stack) {
        for (const l of log.stack.split('\n').slice(0, 5)) {
          lines.push(`      ${l.trim()}`);
        }
      }
    }

    return lines.join('\n');
  }

  async downloadLogs(): Promise<void> {
    const text = await this.exportAsText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async copyToClipboard(): Promise<void> {
    const text = await this.exportAsText();
    await navigator.clipboard.writeText(text);
  }

  async getSystemInfo(): Promise<SystemInfo & { logsEnBase?: number }> {
    try {
      const db = await getDb();
      let dbVersion = 0;
      try {
        const r = await db.select<any[]>(`SELECT version FROM database_version WHERE id = 1`);
        if (r.length > 0) dbVersion = r[0].version;
      } catch (_) {}

      const tables = await db.select<any[]>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      );
      let totalRecords = 0;
      for (const t of tables) {
        try {
          const c = await db.select<any[]>(`SELECT COUNT(*) as n FROM ${t.name}`);
          totalRecords += c[0]?.n || 0;
        } catch (_) {}
      }

      let lastBackup: string | null = null;
      try {
        const b = JSON.parse(localStorage.getItem('backup_list') || '[]');
        if (b.length > 0) lastBackup = b[b.length - 1].timestamp;
      } catch (_) {}

      const mem = (performance as any).memory;
      const memoryUsage = mem
        ? `${Math.round(mem.usedJSHeapSize / 1024 / 1024)} MB / ${Math.round(mem.jsHeapSizeLimit / 1024 / 1024)} MB`
        : 'Non disponible';

      let logsEnBase = 0;
      try {
        const lc = await db.select<any[]>(`SELECT COUNT(*) as n FROM debug_logs`);
        logsEnBase = lc[0]?.n || 0;
      } catch (_) {}

      return {
        appVersion: APP_VERSION,
        dbVersion,
        tablesCount: tables.length,
        totalRecords,
        lastBackup,
        dbPath: 'sqlite:gestion-commerciale.db',
        platform: navigator.platform,
        memoryUsage,
        uptime: Math.round(performance.now() / 60000),
        logsEnBase,
      };
    } catch {
      return {
        appVersion: APP_VERSION,
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

  getLogStats() {
    const levels: Record<string, number> = {};
    const categories: Record<string, number> = {};
    for (const log of this.memLogs) {
      levels[log.level] = (levels[log.level] || 0) + 1;
      categories[log.category] = (categories[log.category] || 0) + 1;
    }
    return { total: this.memLogs.length, levels, categories };
  }
}

export const debugService = new DebugService();

// Hook compatible avec le code existant
export const useDebug = (componentName: string) => ({
  logInfo: (message: string, details?: any) => debugService.info(componentName, message, details),
  logWarning: (message: string, details?: any) => debugService.warn(componentName, message, details),
  logError: (message: string, error?: Error, details?: any) => debugService.error(componentName, message, error, details),
  logDebug: (message: string, details?: any) => debugService.debug(componentName, message, details),
  logAction: (action: string, data?: any) => debugService.debug(componentName, `Action: ${action}`, data),
  logMount: () => debugService.info(componentName, 'Composant monté'),
  logUnmount: () => debugService.info(componentName, 'Composant démonté'),
  logRender: (_props?: any) => { /* silencieux */ },
  logStateChange: (name: string, _old: any, newVal: any) =>
    debugService.debug(componentName, `État modifié: ${name}`, { valeur: newVal }),
  logApiCall: async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
    const t0 = performance.now();
    try {
      const r = await fn();
      debugService.info(componentName, `${name} OK (${Math.round(performance.now() - t0)}ms)`);
      return r;
    } catch (e) {
      debugService.error(componentName, `${name} ECHEC`, e as Error);
      throw e;
    }
  },
  debugService,
});

export default debugService;
