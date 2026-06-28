import { Project } from "ts-morph";
import { GraphIR, IR_SCHEMA_VERSION, type GraphNode, type GraphEdge } from "@dev-flow/ir";
import { buildModuleNodes } from "./modules.js";
import { buildFunctionGraph } from "./functions.js";
import { defaultDetectors } from "./express.js";
import { buildTypesAndModels } from "./types-flow.js";
import { normalizeIr } from "./normalize.js";

export * from "./ids.js";
export { buildModuleNodes } from "./modules.js";
export { buildFunctionGraph } from "./functions.js";
export { defaultDetectors, expressDetector, type EntrypointDetector } from "./express.js";
export { buildTypesAndModels } from "./types-flow.js";
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
  collect(buildFunctionGraph(project, rootDir));
  for (const detector of defaultDetectors) collect(detector.detect(project, rootDir));

  const flow = buildTypesAndModels(project, rootDir);
  for (const n of nodes) {
    if (n.kind === "function") {
      const sig = flow.signatures.get(n.id);
      if (sig) n.signature = sig;
    }
  }
  nodes.push(...flow.modelNodes);
  edges.push(...flow.dataEdges);

  const ir = GraphIR.parse({ schemaVersion: IR_SCHEMA_VERSION, language: "typescript", nodes, edges, warnings });
  return normalizeIr(ir, rootDir);
}
