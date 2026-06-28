import { Project } from "ts-morph";
import { GraphIR, IR_SCHEMA_VERSION, type GraphNode, type GraphEdge } from "@dev-flow/ir";
import { buildModuleNodes } from "./modules.js";
import { normalizeIr } from "./normalize.js";

export * from "./ids.js";
export { buildModuleNodes } from "./modules.js";
export { normalizeIr } from "./normalize.js";

interface Contribution {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  warnings?: string[];
}

export function analyzeProject(project: Project, rootDir: string): GraphIR {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const collect = (c: Contribution) => {
    if (c.nodes) nodes.push(...c.nodes);
    if (c.edges) edges.push(...c.edges);
    if (c.warnings) warnings.push(...c.warnings);
  };

  collect(buildModuleNodes(project, rootDir));

  const ir = GraphIR.parse({ schemaVersion: IR_SCHEMA_VERSION, language: "typescript", nodes, edges, warnings });
  return normalizeIr(ir, rootDir);
}
