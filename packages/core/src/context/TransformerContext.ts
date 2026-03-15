import { DocumentNode } from "../definition/DocumentNode.js";
import { ITransformerPlugin } from "../plugins/ITransformerPlugin.js";
import { ITransformerContext } from "./ITransformerContext.js";

interface TransformerContextOptions {
  outputDirectory?: string;
}

export class TransformerContext implements ITransformerContext {
  readonly plugins: ITransformerPlugin[] = [];
  readonly base: DocumentNode;
  readonly outputDirectory: string;

  private _workInProgress: DocumentNode | null = null;

  constructor(options: TransformerContextOptions = {}) {
    this.base = DocumentNode.create();
    this.outputDirectory = options.outputDirectory || "generated";
  }

  get document() {
    if (!this._workInProgress) {
      throw new Error("Work has not been started yet.");
    }

    return this._workInProgress;
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
    console.log("Starting work with document:", this._workInProgress.toString());
    return this._workInProgress;
  }

  public finishWork() {
    if (this._workInProgress) {
      this._workInProgress = null;
    }
  }
}
