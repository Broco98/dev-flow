import { relative, sep } from "node:path";
import { Node, SyntaxKind } from "ts-morph";

/** Project-root-relative, forward-slash path. OS-stable for ids and snapshots. */
export function toPosixRelative(rootDir: string, file: string): string {
  return relative(rootDir, file).split(sep).join("/");
}

export function moduleNodeId(rootDir: string, file: string): string {
  return `module:${toPosixRelative(rootDir, file)}`;
}

/** Best-effort human name for any function-like declaration. */
export function functionName(decl: Node): string {
  if (Node.isFunctionDeclaration(decl) || Node.isMethodDeclaration(decl)) {
    const n = decl.getName();
    if (n) return n;
  }
  const varDecl = decl.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (varDecl) return varDecl.getName();
  return `anon@${decl.getStartLineNumber()}`;
}

/** Stable id for a function node, identical no matter which task computes it. */
export function functionNodeId(rootDir: string, decl: Node): string {
  const file = toPosixRelative(rootDir, decl.getSourceFile().getFilePath());
  return `fn:${file}#${functionName(decl)}`;
}

export function entrypointNodeId(method: string, route: string): string {
  return `ep:${method.toUpperCase()} ${route}`;
}

export function modelNodeId(rootDir: string, file: string, name: string): string {
  return `model:${toPosixRelative(rootDir, file)}#${name}`;
}
