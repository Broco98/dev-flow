import { CallExpression, Node, type TypeChecker } from "ts-morph";

export type CallResolution =
  | { status: "resolved"; decl: Node }
  | { status: "external" } // resolves into node_modules / lib .d.ts / type-only
  | { status: "unresolved" }; // truly dynamic: no symbol AND no signature

/**
 * Classify a call. Handles fn() and obj.method(), unwraps import/re-export
 * aliases, and uses the checker for exact overloads. (Verified ts-morph 28.)
 */
export function resolveCall(call: CallExpression, checker: TypeChecker): CallResolution {
  const sym = call.getExpression().getSymbol();
  // getAliasedSymbol() returns undefined when NOT an alias -> safe.
  // Do NOT use getImmediatelyAliasedSymbol(): it THROWS on non-aliases.
  const target = sym?.getAliasedSymbol() ?? sym;
  const decl = checker.getResolvedSignature(call)?.getDeclaration() ?? target?.getDeclarations()?.[0];
  if (!decl) return { status: "unresolved" };
  const declFile = decl.getSourceFile();
  if (declFile.isInNodeModules() || declFile.isDeclarationFile()) return { status: "external" };
  if (Node.isFunctionTypeNode(decl) || Node.isMethodSignature(decl)) return { status: "external" };
  return { status: "resolved", decl };
}

/** The nearest enclosing function-like declaration of a node, if any. */
export function enclosingFunctionDecl(node: Node): Node | undefined {
  return node.getFirstAncestor(
    (a) =>
      Node.isFunctionDeclaration(a) ||
      Node.isMethodDeclaration(a) ||
      Node.isArrowFunction(a) ||
      Node.isFunctionExpression(a),
  );
}
