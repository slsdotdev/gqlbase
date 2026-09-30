import { createLogger, Logger } from "@gqlbase/shared/logger";
import { DocumentNode } from "../definition/DocumentNode.js";
import { ITransformerPlugin } from "../plugins/ITransformerPlugin.js";
import { FileArtifact, ITransformerContext } from "./ITransformerContext.js";
import { resolveTransformerOptions, TransformerOptions } from "./TransformerOptions.js";

export interface TransformerContextOptions extends Partial<TransformerOptions> {
  logger?: Logger;
}

export class TransformerContext implements ITransformerContext {
  readonly plugins: ITransformerPlugin[] = [];
  readonly base: DocumentNode;
  readonly logger: Logger;
  readonly options: Readonly<TransformerOptions>;

  private _workInProgress: DocumentNode | null = null;
  private _fileArtifacts: FileArtifact[] | null = [];

  constructor(options: TransformerContextOptions = {}) {
    const { logger, ...transformerOptions } = options;

    this.base = DocumentNode.create();
    this.logger = logger ?? createLogger("TransformerContext", "error");
    this.options = resolveTransformerOptions(transformerOptions);
  }

  get document() {
    if (!this._workInProgress) {
      throw new Error("Work has not been started yet.");
    }

    return this._workInProgress;
  }

  get files() {
    if (!this._fileArtifacts) {
      throw new Error("Work has not been started yet.");
    }

    return this._fileArtifacts;
  }

  public registerPlugin(plugin: ITransformerPlugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered.`);
    }

    if (this._workInProgress) {
      throw new Error(`Cannot register plugin ${plugin.name} after work has started.`);
    }

    plugin.init();
    this.plugins.push(plugin);
  }

  public startWork(document: DocumentNode): DocumentNode {
    if (this.plugins.length === 0) {
      throw new Error("Cannot start work without any plugins registered.");
    }

    this._workInProgress = DocumentNode.merge(this.base, document);
    this._fileArtifacts = [];

    this.logger.debug("Starting work with document:", this._workInProgress.toString());
    return this._workInProgress;
  }

  public finishWork() {
    if (this._workInProgress) {
      this._workInProgress = null;
    }

    if (this._fileArtifacts) {
      this._fileArtifacts = null;
    }
  }
}
