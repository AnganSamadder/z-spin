export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Centralized console logger with global gating by level.
 * - Default level is 'warn' (only warnings and errors printed)
 * - Persists chosen level in localStorage under key 'zspin.logLevel'
 * - Provides a global helper on window: ZSPIN_SET_LOG_LEVEL('debug'|'info'|'warn'|'error'|'silent')
 */
export class Logger {
  private static currentLevel: LogLevel = 'warn';
  private static originalConsole: {
    log: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  } = {
    log: console.log.bind(console),
    info: console.info ? console.info.bind(console) : console.log.bind(console),
    debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
    warn: console.warn ? console.warn.bind(console) : console.log.bind(console),
    error: console.error ? console.error.bind(console) : console.log.bind(console),
  };

  private static readonly levelToValue: Record<LogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
  };

  private static noop = (..._args: any[]) => {};

  public static getLevel(): LogLevel {
    return Logger.currentLevel;
  }

  public static setLevel(level: LogLevel): void {
    Logger.currentLevel = level;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('zspin.logLevel', level);
      }
    } catch (_e) {
      // ignore storage issues
    }
  }

  /**
   * Apply the selected log level by swapping console methods.
   * Use this to actually mute/unmute browser console noise.
   */
  public static applyConsoleLevel(level: LogLevel): void {
    Logger.setLevel(level);
    const current = Logger.levelToValue[Logger.currentLevel];

    // Error
    console.error = current >= Logger.levelToValue.error ? Logger.originalConsole.error : Logger.noop;
    // Warn
    console.warn = current >= Logger.levelToValue.warn ? Logger.originalConsole.warn : Logger.noop;
    // Info/log
    console.info = current >= Logger.levelToValue.info ? Logger.originalConsole.info : Logger.noop;
    console.log = current >= Logger.levelToValue.info ? Logger.originalConsole.log : Logger.noop;
    // Debug
    console.debug = current >= Logger.levelToValue.debug ? Logger.originalConsole.debug : Logger.noop;

    // Expose a quick runtime toggle helper for developers
    try {
      if (typeof window !== 'undefined') {
        (window as any).ZSPIN_SET_LOG_LEVEL = (lvl: LogLevel) => {
          Logger.applyConsoleLevel(lvl);
        };
      }
    } catch (_e) {
      // ignore
    }
  }

  public static error(...args: any[]): void {
    if (Logger.levelToValue[Logger.currentLevel] >= Logger.levelToValue.error) {
      Logger.originalConsole.error(...args);
    }
  }

  public static warn(...args: any[]): void {
    if (Logger.levelToValue[Logger.currentLevel] >= Logger.levelToValue.warn) {
      Logger.originalConsole.warn(...args);
    }
  }

  public static info(...args: any[]): void {
    if (Logger.levelToValue[Logger.currentLevel] >= Logger.levelToValue.info) {
      Logger.originalConsole.info(...args);
    }
  }

  public static log(...args: any[]): void {
    if (Logger.levelToValue[Logger.currentLevel] >= Logger.levelToValue.info) {
      Logger.originalConsole.log(...args);
    }
  }

  public static debug(...args: any[]): void {
    if (Logger.levelToValue[Logger.currentLevel] >= Logger.levelToValue.debug) {
      Logger.originalConsole.debug(...args);
    }
  }

  /**
   * Initialize from persisted preference if present. Does not modify console until applyConsoleLevel is called.
   */
  public static initFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('zspin.logLevel') as LogLevel | null;
        if (saved && Logger.levelToValue[saved] !== undefined) {
          Logger.currentLevel = saved;
        }
      }
    } catch (_e) {
      // ignore
    }
  }
}

// Initialize level from storage on load
Logger.initFromStorage();

export default Logger;


