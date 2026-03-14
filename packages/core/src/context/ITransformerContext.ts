import { ITransformerPlugin } from "../plugins";

export interface ITransformerContext {
  /**
   * An array of registered transformer plugins. Plugins can access this array to interact with other plugins or to add new plugins dynamically.
   */
  readonly plugins: ITransformerPlugin[];

  /**
   * The GraphQL document being transformed. This is a mutable object that plugins can modify during the transformation process.
   */
  document: unknown;

  /**
   * A function that allows plugins to register new transformer plugins. This can be used to add additional functionality or to create plugin chains.
   * @param plugin - The transformer plugin to register.
   */
  registerPlugin(plugin: ITransformerPlugin): void;

  /**
   * A function that initializes all registered plugins. This is called once when the transformation process begins and can be used to set up any necessary state or configuration for the plugins.
   */
  initPlugins(): void;
}
