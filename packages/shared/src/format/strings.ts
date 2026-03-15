const WORD_MATCH_EXP = /(?<=[A-Z])(?=[A-Z][a-z])|(?<=[^A-Z])(?=[A-Z])|(?<=[A-Za-z])(?=[^A-Za-z])/;

function normalize(...strings: string[]): string[] {
  return (
    strings
      // First, split on dashes, underscores, whitespace, etc.
      .flatMap((s) => s.split(/[-_\s\b\W]/).filter(Boolean))
      // Then split each segment by the camel/snake boundaries
      .flatMap((segment) => {
        const tokens = segment.split(WORD_MATCH_EXP);
        if (tokens.length === 0) return [];
        const result: string[] = [];
        // Special case: if the segment starts with an uppercase sequence that’s split
        // into two tokens (e.g. "WARzone" -> ["WA", "Rzone"])
        if (
          tokens.length > 1 &&
          tokens[0] === tokens[0].toUpperCase() &&
          /^[A-Z][a-z]/.test(tokens[1])
        ) {
          // Merge the first token and the first character of the second token
          const merged = tokens[0] + tokens[1][0];
          result.push(merged.toLowerCase());
          // If there are more characters in tokens[1], add them as a separate (lowercased) token
          if (tokens[1].length > 1) {
            result.push(tokens[1].slice(1).toLowerCase());
          }
          // Process any remaining tokens.
          for (let i = 2; i < tokens.length; i++) {
            // For non-first tokens, if a token is entirely uppercase, keep it
            result.push(
              tokens[i] === tokens[i].toUpperCase() ? tokens[i] : tokens[i].toLowerCase()
            );
          }
        } else {
          // Standard processing:
          // Always lower-case the first token.
          result.push(tokens[0].toLowerCase());
          // For subsequent tokens, if the token is all uppercase (like "QL" in "GraphQL")
          // keep it; otherwise, lower-case it.
          for (let i = 1; i < tokens.length; i++) {
            result.push(
              tokens[i] === tokens[i].toUpperCase() ? tokens[i] : tokens[i].toLowerCase()
            );
          }
        }
        return result;
      })
  );
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pascalCase(...string: string[]): string {
  return normalize(...string)
    .map(capitalize)
    .join("");
}

export function camelCase(...string: string[]): string {
  return normalize(...string)
    .filter(Boolean)
    .map((s, i) => (i === 0 ? s.toLowerCase() : capitalize(s)))
    .join("");
}

const PLURAL_RULES: [RegExp, string][] = [
  [/s?$/i, "s"],
  [/([^aeiou]ese)$/i, "$1"],
  [/(ax|test)is$/i, "$1es"],
  [/(alias|[^aou]us|t[lm]as|gas|ris)$/i, "$1es"],
  [/(e[mn]u)s?$/i, "$1s"],
  [/([^l]ias|[aeiou]las|[ejzr]as|[iu]am)$/i, "$1"],
  [/(alumn|syllab|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, "$1i"],
  [/(alumn|alg|vertebr)(?:a|ae)$/i, "$1ae"],
  [/(seraph|cherub)(?:im)?$/i, "$1im"],
  [/(her|at|gr)o$/i, "$1oes"],
  [
    /(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i,
    "$1a",
  ],
  [
    /(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i,
    "$1a",
  ],
  [/sis$/i, "ses"],
  [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, "$1$2ves"],
  [/([^aeiouy]|qu)y$/i, "$1ies"],
  [/([^ch][ieo][ln])ey$/i, "$1ies"],
  [/(x|ch|ss|sh|zz)$/i, "$1es"],
  [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, "$1ices"],
  [/\b((?:tit)?m|l)(?:ice|ouse)$/i, "$1ice"],
  [/(pe)(?:rson|ople)$/i, "$1ople"],
  [/(child)(?:ren)?$/i, "$1ren"],
  [/eau(?:x)?$/i, "$0x"],
  [/m[ae]n$/i, "men"],
  [/^thou$/i, "you"],
  [/^data$/i, "$0"],
  [/^sheep$/i, "$0"],
];

function getPluralRule(word: string) {
  for (const rule of [...PLURAL_RULES].reverse()) {
    if (rule[0].test(word)) {
      return rule;
    }
  }

  return null;
}

export function pluralize(word: string) {
  const rule = getPluralRule(word);
  if (!rule) {
    return word;
  }

  return word.replace(rule[0], (...args) => {
    return rule[1].replace(/\$(\d{1,2})/g, (m, i) => {
      return args[i] || "";
    });
  });
}
