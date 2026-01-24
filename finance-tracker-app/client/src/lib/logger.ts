type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
};

const formatMessage = (prefix: string, message: string): string => {
  return `[${prefix}] ${message}`;
};

export const logger = {
  debug: (prefix: string, message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug(formatMessage(prefix, message), ...args);
    }
  },

  info: (prefix: string, message: string, ...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info(formatMessage(prefix, message), ...args);
    }
  },

  warn: (prefix: string, message: string, ...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage(prefix, message), ...args);
    }
  },

  error: (prefix: string, message: string, ...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(formatMessage(prefix, message), ...args);
    }
  },
};
