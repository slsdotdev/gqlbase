import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { dsqlbase } from "../index.js";

describe("dsqlbase SafeInt columns", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
      scalar Counter @gqlbase_typehint(type: bigint)

      type Invoice @model {
        id: ID!
        amount: SafeInt!
        refunded: SafeInt
        views: Counter
        history: [SafeInt!]
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("declares the bigintNumber builder once, decoding to number", () => {
    expect(tables.match(/const bigintNumber = /g)).toHaveLength(1);
    expect(tables).toContain("new ColumnDefinition<TName, ColumnConfig<number, string>>(name, {");
    expect(tables).toContain('dataType: "bigint"');
    expect(tables).toContain("decode: value => Number(value)");
  });

  it("imports the builder's types from @dsqlbase/core", () => {
    expect(tables).toContain(
      'import { ColumnDefinition, type ColumnConfig } from "@dsqlbase/core";'
    );
  });

  it("uses the builder for SafeInt and bigint-hinted columns", () => {
    expect(tables).toContain('amount: bigintNumber("amount").notNull()');
    expect(tables).toContain('refunded: bigintNumber("refunded")');
    expect(tables).toContain('views: bigintNumber("views")');
    expect(tables).not.toMatch(/import \{[^}]*\bbigintNumber\b[^}]*\} from "dsqlbase\/schema"/);
  });

  it("stores a list of SafeInt as json typed number[]", () => {
    expect(tables).toContain('history: json("history").$type<number[]>()');
  });
});

describe("dsqlbase without SafeInt columns", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({ plugins: [dsqlbase()] }).transform(/* GraphQL */ `
      type Invoice @model {
        id: ID!
        total: Int!
      }
    `);

    tables = output.files.find((file) => file.path === "dsqlbase/schema.ts")?.content ?? "";
  });

  it("emits no local builder and no @dsqlbase/core import", () => {
    expect(tables).not.toContain("bigintNumber");
    expect(tables).not.toContain("@dsqlbase/core");
  });
});

describe("dsqlbase() options", () => {
  let output: Record<string, unknown>;

  beforeAll(() => {
    output = createTransformer({
      plugins: [
        dsqlbase({
          emitOutput: true,
          scalarMap: {
            Decimal: { type: "string", dataType: "numeric" },
            Cents: { type: "number", dataType: "bigintNumber" },
          },
        }),
      ],
    }).transform(/* GraphQL */ `
      scalar Decimal @gqlbase_typehint(type: string)
      scalar Cents @gqlbase_typehint(type: number)

      type Invoice @model {
        id: ID!
        rate: Decimal!
        amount: Cents!
      }
    `);
  });

  it("returns the schema when emitOutput is set", () => {
    expect(output.dsqlBaseSchema).toEqual(expect.stringContaining('table("invoices"'));
  });

  it("maps a scalar through scalarMap instead of its hint", () => {
    expect(output.dsqlBaseSchema).toEqual(
      expect.stringContaining('rate: numeric("rate").notNull()')
    );
    expect(output.dsqlBaseSchema).toEqual(
      expect.stringMatching(/import \{[^}]*\bnumeric\b[^}]*\} from "dsqlbase\/schema"/)
    );
  });

  it("can map a scalar to the local bigintNumber builder", () => {
    expect(output.dsqlBaseSchema).toEqual(
      expect.stringContaining('amount: bigintNumber("amount").notNull()')
    );
    expect(output.dsqlBaseSchema).toEqual(expect.stringContaining("const bigintNumber = "));
  });
});
