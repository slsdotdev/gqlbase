import ts from "typescript";

export function printNodeList(nodes: ts.NodeArray<ts.Node>, fileName?: string): string {
  const file = ts.createSourceFile(
    fileName || "file.ts",
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });

  return printer.printList(ts.ListFormat.MultiLine, nodes, file);
}

export const namedImportStatement = (
  from: string,
  names: string[],
  isTypeOnly = false
): ts.ImportDeclaration => {
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      undefined,
      undefined,
      ts.factory.createNamedImports(
        names.map((n) =>
          ts.factory.createImportSpecifier(isTypeOnly, undefined, ts.factory.createIdentifier(n))
        )
      )
    ),
    ts.factory.createStringLiteral(from),
    undefined
  );
};
