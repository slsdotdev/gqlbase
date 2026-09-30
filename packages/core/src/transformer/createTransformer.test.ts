import { describe, expect, it } from "vitest";
import { ITransformerContext } from "../context/index.js";
import { createTransformer } from "./createTransformer.js";

describe("createTransformer", () => {
  it("passes the transformer options to the context", () => {
    let context: ITransformerContext | undefined;

    createTransformer({
      relay: true,
      semanticNullability: true,
      plugins: [
        {
          create: (ctx) => {
            context = ctx;
            return {
              name: "ProbePlugin",
              context: ctx,
              init: () => undefined,
              match: () => false,
            };
          },
        },
      ],
    });

    expect(context?.options).toEqual({
      relay: true,
      semanticNullability: true,
      operations: ["read", "write"],
    });
  });
});
