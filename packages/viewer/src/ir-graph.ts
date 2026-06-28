import type { GraphIR, GraphNode } from "@dev-flow/ir";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

export type FlowNodeData = { ir: GraphNode };

const KIND_TYPE: Record<GraphNode["kind"], string> = {
  entrypoint: "entrypoint",
  function: "fn",
  module: "module",
  model: "model",
  unresolved: "unresolved",
};
const COLUMN_X: Record<GraphNode["kind"], number> = {
  entrypoint: 0,
  function: 300,
  module: 600,
  model: 600,
  unresolved: 300,
};

/** node id -> ids reachable via its outgoing call + dataTouch edges. */
export function buildChildMap(ir: GraphIR): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const e of ir.edges) {
    if (e.kind === "call" || e.kind === "dataTouch") (map[e.source] ??= []).push(e.target);
  }
  return map;
}

/** Visible = entrypoints, plus children of any expanded visible node (transitive). */
export function computeVisibleIds(ir: GraphIR, expanded: Set<string>): Set<string> {
  const childMap = buildChildMap(ir);
  const visible = new Set<string>();
  const queue: string[] = [];
  for (const n of ir.nodes) {
    if (n.kind === "entrypoint") {
      visible.add(n.id);
      queue.push(n.id);
    }
  }
  while (queue.length) {
    const id = queue.pop()!;
    if (!expanded.has(id)) continue;
    for (const child of childMap[id] ?? []) {
      if (!visible.has(child)) {
        visible.add(child);
        queue.push(child);
      }
    }
  }
  return visible;
}

export function buildVisibleGraph(
  ir: GraphIR,
  expanded: Set<string>,
  selectedId: string | null,
): { nodes: RFNode<FlowNodeData>[]; edges: RFEdge[] } {
  const visible = computeVisibleIds(ir, expanded);
  const rowByKind: Record<string, number> = {};
  const nodes: RFNode<FlowNodeData>[] = ir.nodes
    .filter((n) => visible.has(n.id))
    .map((n) => {
      const row = (rowByKind[n.kind] = (rowByKind[n.kind] ?? 0) + 1);
      return {
        id: n.id,
        type: KIND_TYPE[n.kind],
        position: { x: COLUMN_X[n.kind], y: row * 90 },
        data: { ir: n },
        selected: n.id === selectedId,
        style: { width: 220, height: n.kind === "function" ? 76 : 56 },
      };
    });
  const edges: RFEdge[] = ir.edges
    .filter((e) => visible.has(e.source) && visible.has(e.target))
    .map((e, i) => ({
      id: `e${i}:${e.kind}:${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      label: e.kind === "dataTouch" ? (e.meta?.dataType ?? "data") : undefined,
    }));
  return { nodes, edges };
}
