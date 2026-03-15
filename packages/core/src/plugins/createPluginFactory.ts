import { ITransformerContext } from "../context/ITransformerContext.js";
import { IPluginFactory } from "./IPluginFactory.js";
import { ITransformerPlugin } from "./ITransformerPlugin.js";

type PluginConstructor<TOptions> = new (
  context: ITransformerContext,
  options?: TOptions
) => ITransformerPlugin;

export function createPluginFactory<TOptions>(plugin: PluginConstructor<TOptions>) {
  return (options?: TOptions): IPluginFactory => {
    return {
      create: (context: ITransformerContext) => new plugin(context, options),
    };
  };
}
