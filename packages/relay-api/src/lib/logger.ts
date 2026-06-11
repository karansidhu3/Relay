type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>): void =>
    log('INFO', message, context),
  warn: (message: string, context?: Record<string, unknown>): void =>
    log('WARN', message, context),
  error: (message: string, context?: Record<string, unknown>): void =>
    log('ERROR', message, context),
  debug: (message: string, context?: Record<string, unknown>): void =>
    log('DEBUG', message, context),
};
