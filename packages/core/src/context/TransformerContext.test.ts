import { describe, expect, it } from "vitest";
import { TransformerContext } from "./TransformerContext";
import { ITransformerPlugin } from "../plugins";
import { DocumentNode } from "../definition";

const testPlugin: ITransformerPlugin = {
  name: "TestPlugin",
  init: () => ({}),
  match: () => true,
};

describe("TransformerContext", () => {
  it("should initialize plugin", () => {
    const context = new TransformerContext();
    context.registerPlugin(testPlugin);
    expect(context.plugins).toContain(testPlugin);
  });

  it("shuld prevent duplicate plugin registration", () => {
    const context = new TransformerContext();
    context.registerPlugin(testPlugin);

    expect(() => context.registerPlugin(testPlugin)).toThrow(
      `Plugin ${testPlugin.name} is already registered.`
    );
  });

  it("should throw error when trying to register plugin after work has started", () => {
    const context = new TransformerContext();
    context.registerPlugin(testPlugin);
    context.startWork(DocumentNode.create());

    expect(() => context.registerPlugin({ ...testPlugin, name: "TestPlugin2" })).toThrow(
      `Cannot register plugin TestPlugin2 after work has started.`
    );
  });

  it("should throw error when trying to start work without any plugins registered", () => {
    const context = new TransformerContext();
    expect(() => context.startWork(DocumentNode.create())).toThrow(
      "Cannot start work without any plugins registered."
    );
  });

  it("should throw error when trying to get document without starting work", () => {
    const context = new TransformerContext();
    expect(() => context.document).toThrow("Work has not been started yet.");
  });

  it("should start work", () => {
    const context = new TransformerContext();
    context.registerPlugin(testPlugin);
    context.startWork(DocumentNode.create());

    expect(context.document).toBeInstanceOf(DocumentNode);
  });

  it("should finish work", () => {
    const context = new TransformerContext();
    context.registerPlugin(testPlugin);
    context.startWork(DocumentNode.create());
    context.finishWork();

    expect(() => context.document).toThrow("Work has not been started yet.");
  });
});
