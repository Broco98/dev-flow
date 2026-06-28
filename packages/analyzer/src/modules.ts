import { Project } from "ts-morph";
import type { GraphNode } from "@dev-flow/ir";
import { moduleNodeId } from "./ids.js";

export function buildModuleNodes(project: Project, rootDir: string): { nodes: GraphNode[] } {
  const nodes: GraphNode[] = [];
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile()) continue;
    const file = sf.getFilePath();
    nodes.push({
      kind: "module",
      id: moduleNodeId(rootDir, file),
      label: sf.getBaseName(),
      sourceLocation: { file, line: 1 }, // absolute now; normalizeIr relativizes
      parentId: null,
    });
  }
  return { nodes };
}
