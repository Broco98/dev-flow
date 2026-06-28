import { Project, Node, SyntaxKind, type CallExpression } from "ts-morph";
import type { GraphNode, GraphEdge } from "@dev-flow/ir";
import { functionName, functionNodeId, moduleNodeId } from "./ids.js";
import { resolveCall, enclosingFunctionDecl } from "./resolve.js";

/** FunctionDeclarations, named arrow/function-expr initializers, class methods. */
export function collectFunctionDecls(project: Project): Node[] {
  const decls: Node[] = [];
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile()) continue;
    for (const fn of sf.getFunctions()) decls.push(fn);
    for (const v of sf.getVariableDeclarations()) {
      const init = v.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) decls.push(init);
    }
    for (const cls of sf.getClasses()) for (const m of cls.getMethods()) decls.push(m);
  }
  return decls;
}

export function buildFunctionGraph(
  project: Project,
  rootDir: string,
): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] } {
  const checker = project.getTypeChecker();
  const decls = collectFunctionDecls(project);
  const declIds = new Set(decls.map((d) => functionNodeId(rootDir, d)));

  const nodes: GraphNode[] = decls.map((d) => {
    const file = d.getSourceFile().getFilePath();
    return {
      kind: "function",
      id: functionNodeId(rootDir, d),
      label: functionName(d),
      sourceLocation: { file, line: d.getStartLineNumber() },
      parentId: moduleNodeId(rootDir, file),
    };
  });

  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  // contains: module -> function
  for (const d of decls) {
    edges.push({ source: moduleNodeId(rootDir, d.getSourceFile().getFilePath()), target: functionNodeId(rootDir, d), kind: "contains" });
  }

  // call edges + unresolved nodes, de-duplicated
  const seenEdge = new Set<string>();
  const seenUnresolved = new Set<string>();
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile()) continue;
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[]) {
      const fromDecl = enclosingFunctionDecl(call);
      if (!fromDecl) continue;
      const source = functionNodeId(rootDir, fromDecl);
      const res = resolveCall(call, checker);
      if (res.status === "external") continue;

      let target: string;
      if (res.status === "unresolved") {
        const calleeText = call.getExpression().getText();
        target = `unresolved:${calleeText}`;
        if (!seenUnresolved.has(target)) {
          seenUnresolved.add(target);
          nodes.push({
            kind: "unresolved",
            id: target,
            label: calleeText,
            sourceLocation: { file: sf.getFilePath(), line: call.getStartLineNumber() },
            parentId: null,
          });
          warnings.push(`unresolved dynamic call '${calleeText}' at ${sf.getBaseName()}:${call.getStartLineNumber()}`);
        }
      } else {
        target = functionNodeId(rootDir, res.decl);
        if (!declIds.has(target)) continue; // target not a tracked function
      }
      if (source === target) continue;
      const key = `${source}->${target}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push({ source, target, kind: "call" });
    }
  }

  return { nodes, edges, warnings };
}
