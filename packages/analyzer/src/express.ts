import { Project, Node, SyntaxKind, type CallExpression } from "ts-morph";
import type { GraphNode, GraphEdge } from "@dev-flow/ir";
import { entrypointNodeId, functionNodeId } from "./ids.js";

export interface EntrypointDetector {
  readonly name: string;
  detect(project: Project, rootDir: string): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] };
}

const ROUTE_METHODS = new Set(["get", "post", "put", "delete", "patch", "all", "options", "head"]);

/** Resolve a route handler argument to its function declaration node. */
function resolveHandler(arg: Node): Node | undefined {
  if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) return arg; // inline literal
  const id = arg.asKind(SyntaxKind.Identifier);
  if (!id) return undefined;
  let defs: Node[] = [];
  try {
    defs = id.getDefinitionNodes();
  } catch {
    return undefined;
  }
  for (const def of defs) {
    if (Node.isFunctionDeclaration(def)) return def;
    if (Node.isVariableDeclaration(def)) {
      const init = def.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) return init;
    }
  }
  return undefined;
}

export const expressDetector: EntrypointDetector = {
  name: "express",
  detect(project, rootDir) {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const warnings: string[] = [];

    for (const sf of project.getSourceFiles()) {
      if (sf.isDeclarationFile() || sf.isInNodeModules()) continue;
      for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[]) {
        const pae = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
        if (!pae) continue;
        const method = pae.getName();
        if (!ROUTE_METHODS.has(method)) continue;

        const args = call.getArguments();
        const first = args[0];
        const lit =
          first?.asKind(SyntaxKind.StringLiteral) ?? first?.asKind(SyntaxKind.NoSubstitutionTemplateLiteral);
        const route = lit?.getLiteralValue();

        const handlerArgs = args
          .slice(route === undefined ? 0 : 1)
          .filter((a) => Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isIdentifier(a));
        if (handlerArgs.length === 0) continue; // settings getter app.get('view engine'), app.use(mw), etc.

        if (route === undefined) {
          warnings.push(`skipped ${method} route with non-literal path at ${sf.getBaseName()}:${call.getStartLineNumber()}`);
          continue;
        }

        const id = entrypointNodeId(method, route);
        nodes.push({
          kind: "entrypoint",
          id,
          label: `${method.toUpperCase()} ${route}`,
          sourceLocation: { file: sf.getFilePath(), line: call.getStartLineNumber() },
          parentId: null,
          method: method.toUpperCase(),
          route,
        });
        for (const arg of handlerArgs) {
          const handler = resolveHandler(arg);
          if (handler) edges.push({ source: id, target: functionNodeId(rootDir, handler), kind: "call" });
        }
      }
    }

    return { nodes, edges, warnings };
  },
};

export const defaultDetectors: EntrypointDetector[] = [expressDetector];
