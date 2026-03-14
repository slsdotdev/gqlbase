export type LogLevel = "silent" | "debug" | "info" | "warn" | "error";

export class Logger {
  private readonly _scope: string;
  private readonly _level: LogLevel;

  private constructor(scope: string, level: LogLevel) {
    this._scope = scope;
    this._level = level;
  }

  private _log(message: string, ...args: unknown[]): void {
    console.log(`[${this._scope}] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this._level === "debug") {
      this._log(message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (["debug", "info"].includes(this._level)) {
      this._log(message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (["debug", "info", "warn"].includes(this._level)) {
      this._log(message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (["debug", "info", "warn", "error"].includes(this._level)) {
      this._log(message, ...args);
    }
  }

  createChild(scope: string): Logger {
    return new Logger(`${this._scope}:${scope}`, this._level);
  }

  static create(scope: string, level: LogLevel = "info"): Logger {
    return new Logger(scope, level);
  }
}

export function createLogger(scope: string, level: LogLevel = "info"): Logger {
  return Logger.create(scope, level);
}
