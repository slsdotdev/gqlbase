/* eslint-disable @typescript-eslint/no-explicit-any */
import pc from "picocolors";
import util from "node:util";

export type LogLevel = "silent" | "debug" | "info" | "warn" | "error";

export class Logger {
  private readonly _scope: string;
  private readonly _level: LogLevel;

  private constructor(scope: string, level: LogLevel) {
    this._scope = scope;
    this._level = level;
  }

  private _formatMessage(level: string, message: string, ...args: any[]): string {
    const prefix = `gqlbase ${level} ${pc.dim(this._scope)}`;

    const formattedArgs = util
      .format("", message, ...args)
      .split("\n")
      .join("\n" + prefix + " ");

    return `${prefix}${formattedArgs}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this._level === "debug") {
      console.debug(this._formatMessage(pc.cyan("debug"), message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (["debug", "info"].includes(this._level)) {
      console.debug(this._formatMessage(pc.blue("info"), message, ...args));
    }
  }

  success(message: string, ...args: any[]): void {
    if (["debug", "info"].includes(this._level)) {
      console.debug(this._formatMessage(pc.green("success"), message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (["debug", "info", "warn"].includes(this._level)) {
      console.warn(this._formatMessage(pc.yellow("warn"), message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (["debug", "info", "warn", "error"].includes(this._level)) {
      console.error(this._formatMessage(pc.red("error"), message, ...args));
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
