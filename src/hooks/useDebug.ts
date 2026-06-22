// src/hooks/useDebug.ts

import { debugService } from '../services/debugService';

export const useDebug = (componentName: string) => {
  // ✅ Ajouter un timestamp pour chaque log
  const getTimestamp = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('fr-FR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${time}.${ms}`;
  };

  const logInfo = (message: string, details?: any) => {
    console.log(`%c[${getTimestamp()}] ℹ️ ${componentName}: ${message}`, 
      'color: #2196F3; font-weight: bold;', 
      details || ''
    );
    debugService.info(componentName, message, details);
  };

  const logWarning = (message: string, details?: any) => {
    console.warn(`%c[${getTimestamp()}] ⚠️ ${componentName}: ${message}`, 
      'color: #FF9800; font-weight: bold;', 
      details || ''
    );
    debugService.warn(componentName, message, details);
  };

  const logError = (message: string, error?: Error, details?: any) => {
    console.error(`%c[${getTimestamp()}] ❌ ${componentName}: ${message}`, 
      'color: #F44336; font-weight: bold;', 
      error || details || ''
    );
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    debugService.error(componentName, message, error, details);
  };

  const logDebug = (message: string, details?: any) => {
    console.debug(`%c[${getTimestamp()}] 🔍 ${componentName}: ${message}`, 
      'color: #9E9E9E; font-weight: bold;', 
      details || ''
    );
    debugService.debug(componentName, message, details);
  };

  const logAction = (action: string, data?: any) => {
    console.log(`%c[${getTimestamp()}] 🎯 ${componentName}: Action: ${action}`, 
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
    console.log(`%c[${getTimestamp()}] 🌐 ${componentName}: Appel API: ${name}`, 
      'color: #00BCD4; font-weight: bold;', 
      context || ''
    );
    
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - startTime);
      console.log(`%c[${getTimestamp()}] ✅ ${componentName}: API ${name} terminé en ${duration}ms`, 
        'color: #4CAF50; font-weight: bold;', 
        result
      );
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      console.error(`%c[${getTimestamp()}] ❌ ${componentName}: API ${name} échoué après ${duration}ms`, 
        'color: #F44336; font-weight: bold;', 
        error
      );
      throw error;
    }
  };

  const logRender = (props?: any) => {
    console.debug(`%c[${getTimestamp()}] 🔄 ${componentName}: Render`, 
      'color: #8BC34A; font-weight: bold;', 
      props || ''
    );
    debugService.debug(componentName, 'Render', { props });
  };

  const logMount = () => {
    console.log(`%c[${getTimestamp()}] 📦 ${componentName}: Component mounted`, 
      'color: #4CAF50; font-weight: bold;'
    );
    debugService.info(componentName, 'Component mounted');
  };

  const logUnmount = () => {
    console.log(`%c[${getTimestamp()}] 📦 ${componentName}: Component unmounted`, 
      'color: #FF5722; font-weight: bold;'
    );
    debugService.info(componentName, 'Component unmounted');
  };

  const logStateChange = (stateName: string, oldValue: any, newValue: any) => {
    console.debug(`%c[${getTimestamp()}] 🔄 ${componentName}: State: ${stateName}`, 
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

export default useDebug;