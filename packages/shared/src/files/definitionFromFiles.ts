import { globSync } from "tinyglobby";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const GRAPHQL_EXTENSIONS = [".gql", ".graphql", ".graphqls"] as const;

export const GRAPHQL_GLOB = `**/*{${GRAPHQL_EXTENSIONS.join(",")}}`;

export const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
];

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

export const isGraphQLFile = (filePath: string): boolean => {
  const lower = filePath.toLowerCase();
  return GRAPHQL_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export const normalizePaths = (paths: string[]): string[] => {
  const normalized: string[] = [];

  for (const path of paths) {
    const resolved = resolve(path);

    if (isDirectory(resolved)) {
      normalized.push(`${resolved}/${GRAPHQL_GLOB}`);
    } else {
      normalized.push(path);
    }
  }

  return normalized;
};

export const getValidPathsFormSource = (
  source: string | string[],
  ignore: string[] = []
): string[] => {
  const files = Array.isArray(source) ? source : [source];
  const patterns = normalizePaths(files);

  const paths = globSync(patterns, {
    absolute: true,
    onlyFiles: true,
    ignore: [...DEFAULT_IGNORE_PATTERNS, ...ignore],
  }).map((entry) => entry.toString());

  return paths.filter(isGraphQLFile);
};

export function definitionFromFiles(source: string | string[]): string {
  const paths = getValidPathsFormSource(source);

  if (!paths.length) {
    throw new Error(
      `No valid GraphQL files (.graphql, .gql, .graphqls) found at provided source: ${[source].flat().join(", ")}`
    );
  }

  let definition = "";

  for (const path of paths) {
    definition += readFileSync(path, { encoding: "utf-8" });
  }

  return definition;
}
