import { describe, expect, it, vi } from "vitest";
import { ITransformerPlugin } from "./ITransformerPlugin.js";
import { ITransformerContext } from "../context/ITransformerContext.js";
import { createPluginFactory } from "./createPluginFactory.js";

class MockPlugin implements ITransformerPlugin {
  name = "MockPlugin";
  context: ITransformerContext;
  options: { type: string };

  constructor(context: ITransformerContext, options = { type: "hello" }) {
    this.context = context;
    this.options = options;
  }

  init = vi.fn();
  match = vi.fn().mockReturnValue(true);
}

describe("createPluginFactory", () => {
  it("should create a plugin factory that produces plugin instances", () => {
    const mockPlugin = createPluginFactory(MockPlugin);

    const pluginFactory = mockPlugin();
    expect(pluginFactory.create).toBeInstanceOf(Function);
  });
});
