import { ITransformerContext } from "@gqlbase/core/context";
import { ArgumentNode, DirectiveNode, ScalarNode, ValueNode } from "@gqlbase/core/definition";
import { createPluginFactory, TransformerPluginBase } from "@gqlbase/core/plugins";

/**
 * Adds support for custom, commonly used scalars.
 *
 * The implementation of these scalars is left to the user, but they help provide a common interface for platforms that implement custom scalars.
 *
 * Scalars:
 *
 * - `DateTime`: ISO-8601 formatted date-time string.
 *    Specified by: http://www.ietf.org/rfc/rfc3339.txt
 *    Example: `"2023-01-01T12:34:56Z"`, `"1999-12-31T23:59:59+00:00"`
 *
 * - `Date`: ISO-8601 formatted date string (YYYY-MM-DD).
 *    Specified by: http://www.ietf.org/rfc/rfc3339.txt
 *    Example: `"2023-01-01"`, `"1999-12-31"`
 *
 * - `Time`: ISO-8601 formatted time string (hh:mm:ss).
 *    Specified by: http://www.ietf.org/rfc/rfc3339.txt
 *    Example: `"12:34:56"`, `"23:59"`, `"00:00"`
 *
 * - `Timestamp`: Unix timestamp (number of seconds since January 1, 1970).
 *    Specified by: https://en.wikipedia.org/wiki/Unix_time
 *    Example: `1627846261`, `-1234567890`
 *
 * - `URL`: A valid URL string.
 *    Specified by: https://www.ietf.org/rfc/rfc3986.txt
 *    Example: `"https://www.example.com"`, `"ftp://ftp.example.com/resource.txt"`
 *
 * - `EmailAddress`: A valid email address string.
 *    Specified by: https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
 *    Example: `"
 *
 * - `PhoneNumber`: A valid phone number string.
 *    Specified by: https://www.itu.int/rec/T-REC-E.164
 *    Example: `"+1-202-555-0123"`, `"+44 20 7946 0958"`
 *
 * - `IPAddress`: A valid IPv4 or IPv6 address string.
 *    Specified by: https://www.ietf.org/rfc/rfc3986.txt
 *    Example: `"
 *
 * - `JSON`: Arbitrary JSON value.
 *    Specified by: https://json.org/
 *    Example: `{"key": "value", "array": [1, 2, 3], "nested": {"foo": "bar"}}`
 *
 * - `UUID`: A valid UUID v4 string.
 *    Specified by: http://rfc-editor.org/rfc/rfc9562
 *    Example: `"550e8400-e29b-41d4-a716-446655440000"`, `"123e4567-e89b-12d3-a456-426614174000"`
 *
 */

export class ScalarsPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("ScalarsPlugin", context);
  }

  public init() {
    this.context.base
      .addNode(
        ScalarNode.create("DateTime", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("http://www.ietf.org/rfc/rfc3339.txt")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("Date", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("http://www.ietf.org/rfc/rfc3339.txt")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("Time", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("http://www.ietf.org/rfc/rfc3339.txt")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("Timestamp", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("https://en.wikipedia.org/wiki/Unix_time")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("number")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("UUID", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("http://rfc-editor.org/rfc/rfc9562")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("id")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("URL", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("https://www.ietf.org/rfc/rfc3986.txt")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("EmailAddress", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create(
              "url",
              ValueNode.string(
                "https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address"
              )
            ),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("PhoneNumber", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("https://www.itu.int/rec/T-REC-E.164")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("IPAddress", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("https://www.ietf.org/rfc/rfc3986.txt")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("string")),
          ]),
        ])
      )
      .addNode(
        ScalarNode.create("JSON", undefined, [
          DirectiveNode.create("specifiedBy", [
            ArgumentNode.create("url", ValueNode.string("https://json.org/")),
          ]),
          DirectiveNode.create("gqlbase_typehint", [
            ArgumentNode.create("type", ValueNode.enum("object")),
          ]),
        ])
      );
  }
}

export const scalarsPlugin = createPluginFactory(ScalarsPlugin);
