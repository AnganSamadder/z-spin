import type { LogLevel } from './modules/utils/Logger';

// Global, code-level logging controls
// Change these to control console behavior without touching runtime state.
export const DEFAULT_LOG_LEVEL: LogLevel = 'warn';

// If true, turning Debug Mode ON will also enable verbose console logs.
// If false, Debug Mode will NOT increase console verbosity.
export const ALLOW_CONSOLE_LOGS_IN_DEBUG: boolean = false;


