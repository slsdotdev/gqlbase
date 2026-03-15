import { DocumentNode } from "../definition/DocumentNode.js";
import { ITransformerPlugin } from "../plugins/ITransformerPlugin.js";

export interface ITransformerContext {
  /**
   * The output directory where the transformed GraphQL documents or generated code will be saved. This can be used by plugins to determine where to write their output files.
   */
  readonly outputDirectory: string;

  /** The base GraphQL document that serves as the starting point for transformations. This document can be used py plugin to register new types, fields, or other GraphQL constructs that can be referenced by other plugins during the transformation process.
   */
  readonly base: DocumentNode;

  /**
   * An array of registered transformer plugins. Plugins can access this array to interact with other plugins or to add new plugins dynamically.
   */
  readonly plugins: ITransformerPlugin[];

  /**
   * The GraphQL document being transformed. This is a mutable object that plugins can modify during the transformation process.
   */
  document: DocumentNode;

  /**
   * A function that allows plugins to register new transformer plugins. This can be used to add additional functionality or to create plugin chains.
   * @param plugin - The transformer plugin to register.
   */
  registerPlugin(plugin: ITransformerPlugin): void;

  /**
   * A function to start the transformation work by providing the initial GraphQL document. This function initializes the transformation context with the provided document.
   * @param document - The initial GraphQL document to transform.
   */
  startWork(document: DocumentNode): DocumentNode;

  /**
   * A function to finish the transformation work. This can be used to perform any necessary cleanup after the transformation process is complete.
   */
  finishWork(): void;
}
