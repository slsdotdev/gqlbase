import type { ITransformerContext } from "../../context/index.js";
import {
  DefinitionNode,
  FieldNode,
  InterfaceNode,
  isDirectiveDefinitionNode,
  isInputObjectNode,
  isInterfaceNode,
  isObjectNode,
  isUnionNode,
  ObjectNode,
  OPERATION_NODE_NAME,
} from "../../definition/index.js";
import { isInternal } from "../InternalUtilsPlugin/index.js";
import { isServerOnly, isWriteOnly } from "../UtilitiesPlugin/index.js";

/**
 * Whether a field reaches the client schema. `@serverOnly` and `@writeOnly` fields are stored but never returned, internal fields are gqlbase's own, and a `@serverOnly` type has no public fields. Generators run before `cleanup` removes them, so they use this to leave them out themselves.
 *
 * @param field The field to check.
 * @param parent The object or interface that declares the field.
 */

export const isPublicSchemaField = (field: FieldNode, parent: ObjectNode | InterfaceNode) => {
  return (
    !isInternal(parent) &&
    !isServerOnly(parent) &&
    !isInternal(field) &&
    !isServerOnly(field) &&
    !isWriteOnly(field)
  );
};

/**
 * Collects the names of the definitions reachable from the operation types and from the directive definitions declared in the source, through the fields `includeField` accepts, their arguments, input fields, interfaces (with their implementors) and union members. Internal definitions are never reached.
 *
 * Plugin-declared directive definitions (those on `context.base`) are not roots: most of them are removed before the output is printed.
 *
 * @param includeField Which object and interface fields to follow.
 * @param includeDefinition Which definitions can be reached at all.
 */

export const collectReachableDefinitions = (
  context: ITransformerContext,
  includeField: (field: FieldNode, parent: ObjectNode | InterfaceNode) => boolean,
  includeDefinition: (node: DefinitionNode) => boolean = () => true
): Set<string> => {
  const { document, base } = context;
  const reached = new Set<string>();
  const queue: DefinitionNode[] = [];

  const visit = (name: string) => {
    if (reached.has(name)) return;

    const node = document.getNode(name);

    if (!node || isInternal(node) || !includeDefinition(node)) return;

    reached.add(name);
    queue.push(node);
  };

  for (const name of OPERATION_NODE_NAME) {
    visit(name);
  }

  for (const node of document.definitions.values()) {
    if (isDirectiveDefinitionNode(node) && !base.hasNode(node.name)) {
      for (const argument of node.arguments ?? []) {
        visit(argument.type.getTypeName());
      }
    }
  }

  for (let node = queue.shift(); node; node = queue.shift()) {
    if (isObjectNode(node) || isInterfaceNode(node)) {
      for (const field of node.fields ?? []) {
        if (!includeField(field, node)) continue;

        visit(field.type.getTypeName());

        for (const argument of field.arguments ?? []) {
          visit(argument.type.getTypeName());
        }
      }

      for (const iface of node.interfaces ?? []) {
        visit(iface.getTypeName());
      }
    }

    if (isInterfaceNode(node)) {
      for (const candidate of document.definitions.values()) {
        if (
          (isObjectNode(candidate) || isInterfaceNode(candidate)) &&
          candidate.hasInterface(node.name)
        ) {
          visit(candidate.name);
        }
      }
    }

    if (isUnionNode(node)) {
      for (const member of node.types ?? []) {
        visit(member.getTypeName());
      }
    }

    if (isInputObjectNode(node)) {
      for (const field of node.fields ?? []) {
        if (!isInternal(field)) {
          visit(field.type.getTypeName());
        }
      }
    }
  }

  return reached;
};

/**
 * Collects the names of the definitions that reach the client schema: everything reachable through public fields (see `isPublicSchemaField`), except `@serverOnly` types, which are not reached even as implementors of a public interface.
 */

export const collectPublicDefinitions = (context: ITransformerContext): Set<string> => {
  return collectReachableDefinitions(
    context,
    isPublicSchemaField,
    (node) => !(isObjectNode(node) && isServerOnly(node))
  );
};
