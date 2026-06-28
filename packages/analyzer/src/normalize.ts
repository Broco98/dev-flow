import type { GraphIR } from "@dev-flow/ir";
import { toPosixRelative } from "./ids.js";

/** Make the IR deterministic: relative posix file paths + sorted nodes/edges/warnings. */
export function normalizeIr(ir: GraphIR, rootDir: string): GraphIR {
  const nodes = ir.nodes
    .map((n) => ({
      ...n,
      sourceLocation: { ...n.sourceLocation, file: toPosixRelative(rootDir, n.sourceLocation.file) },
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...ir.edges].sort((a, b) =>
    `${a.source}->${a.target}:${a.kind}`.localeCompare(`${b.source}->${b.target}:${b.kind}`),
  );
  const warnings = [...ir.warnings].sort((a, b) => a.localeCompare(b));
  return { ...ir, nodes, edges, warnings };
}
