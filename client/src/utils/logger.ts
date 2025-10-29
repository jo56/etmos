const isDevelopment = import.meta.env.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private enabled: boolean;

  constructor() {
    this.enabled = isDevelopment;
  }

  private log(level: LogLevel, ...args: any[]) {
    if (!this.enabled && level !== 'error') return;
    console[level](...args);
  }

  debug(...args: any[]) {
    this.log('debug', '[DEBUG]', ...args);
  }

  info(...args: any[]) {
    this.log('info', '[INFO]', ...args);
  }

  warn(...args: any[]) {
    this.log('warn', '[WARN]', ...args);
  }

  error(...args: any[]) {
    this.log('error', '[ERROR]', ...args);
  }
}

export const logger = new Logger();
