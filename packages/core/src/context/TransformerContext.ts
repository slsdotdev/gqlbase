import { DocumentNode } from "../definition";
import { ITransformerPlugin } from "../plugins/ITransformerPlugin";
import { ITransformerContext } from "./ITransformerContext";

export class TransformerContext implements ITransformerContext {
  readonly plugins: ITransformerPlugin[] = [];
  readonly base: DocumentNode;

  private _workInProgress: DocumentNode | null = null;

  constructor() {
    this.base = DocumentNode.create();
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
    return this._workInProgress;
  }

  public finishWork() {
    if (this._workInProgress) {
      this._workInProgress = null;
    }
  }
}
