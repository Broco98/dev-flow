import { Project, Node, TypeFormatFlags, type Type } from "ts-morph";
import type { FunctionSignature, GraphNode, GraphEdge } from "@dev-flow/ir";
import { functionNodeId, modelNodeId } from "./ids.js";
import { collectFunctionDecls } from "./functions.js";

const FLAGS = TypeFormatFlags.NoTruncation | TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/** Readable param + return types. Prefers the as-written annotation. */
export function extractSignature(decl: Node): FunctionSignature | undefined {
  if (
    !Node.isFunctionDeclaration(decl) &&
    !Node.isArrowFunction(decl) &&
    !Node.isMethodDeclaration(decl) &&
    !Node.isFunctionExpression(decl)
  ) {
    return undefined;
  }
  const params = decl.getParameters().map((p) => ({
    name: p.getName(),
    typeText: p.getTypeNode()?.getText() ?? p.getType().getText(p, FLAGS),
  }));
  const returnText = decl.getReturnTypeNode()?.getText() ?? decl.getReturnType().getText(decl, FLAGS);
  return { params, returnText };
}

/** Unwrap Promise<T> and T[] to the underlying named type's symbol name. */
function unwrapModelName(t: Type): string | undefined {
  let cur = t;
  if (cur.getSymbol()?.getName() === "Promise") {
    const arg = cur.getTypeArguments()[0];
    if (arg) cur = arg;
  }
  if (cur.isArray()) cur = cur.getArrayElementTypeOrThrow();
  return (cur.getSymbol() ?? cur.getAliasSymbol())?.getName();
}

export function buildTypesAndModels(
  project: Project,
  rootDir: string,
): { signatures: Map<string, FunctionSignature>; modelNodes: GraphNode[]; dataEdges: GraphEdge[] } {
  const signatures = new Map<string, FunctionSignature>();
  for (const decl of collectFunctionDecls(project)) {
    const sig = extractSignature(decl);
    if (sig) signatures.set(functionNodeId(rootDir, decl), sig);
  }

  const modelNodes: GraphNode[] = [];
  const modelIdByName = new Map<string, string>();
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile() || sf.isInNodeModules()) continue;
    const file = sf.getFilePath();
    const add = (name: string, modelKind: "interface" | "class" | "typeAlias", line: number) => {
      const id = modelNodeId(rootDir, file, name);
      modelNodes.push({ kind: "model", id, label: name, sourceLocation: { file, line }, parentId: null, modelKind });
      modelIdByName.set(name, id);
    };
    for (const i of sf.getInterfaces()) if (i.isExported()) add(i.getName(), "interface", i.getStartLineNumber());
    for (const t of sf.getTypeAliases()) if (t.isExported()) add(t.getName(), "typeAlias", t.getStartLineNumber());
    for (const c of sf.getClasses()) {
      const name = c.getName();
      if (name && c.isExported()) add(name, "class", c.getStartLineNumber());
    }
  }

  const dataEdges: GraphEdge[] = [];
  for (const decl of collectFunctionDecls(project)) {
    if (!Node.isFunctionDeclaration(decl) && !Node.isArrowFunction(decl) && !Node.isMethodDeclaration(decl)) continue;
    const modelName = unwrapModelName(decl.getReturnType());
    if (!modelName) continue;
    const target = modelIdByName.get(modelName);
    if (!target) continue;
    dataEdges.push({
      source: functionNodeId(rootDir, decl),
      target,
      kind: "dataTouch",
      meta: { access: "read", dataType: modelName },
    });
  }

  return { signatures, modelNodes, dataEdges };
}
