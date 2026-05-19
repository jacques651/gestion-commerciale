// src/utils/logger.ts
export const logger = {
  log: (...args: any[]) => {
    console.log(...args.map(arg => 
      arg instanceof Error ? arg.message : arg
    ));
  },
  error: (...args: any[]) => {
    console.error(...args.map(arg => 
      arg instanceof Error ? arg.message : 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ));
  },
  warn: (...args: any[]) => {
    console.warn(...args.map(arg => 
      arg instanceof Error ? arg.message : arg
    ));
  }
};