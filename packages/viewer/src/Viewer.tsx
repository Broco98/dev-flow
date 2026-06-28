import { useMemo, useCallback } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useShallow } from "zustand/react/shallow";
import { safeParseGraphIR, type GraphIR } from "@dev-flow/ir";
import { buildVisibleGraph } from "./ir-graph";
import { nodeTypes } from "./nodes";
import { useGraphUi } from "./state/uiStore";
import { DetailPanel } from "./DetailPanel";

export function Viewer({ ir }: { ir: unknown }) {
  const parsed = useMemo(() => safeParseGraphIR(ir), [ir]);
  if (!parsed.success) {
    return <div role="alert">Invalid IR: {parsed.error.issues.length} issue(s)</div>;
  }
  return <FlowInner ir={parsed.data} />;
}

function FlowInner({ ir }: { ir: GraphIR }) {
  const { selectedId, expanded } = useGraphUi(
    useShallow((s) => ({ selectedId: s.selectedId, expanded: s.expanded })),
  );
  const select = useGraphUi((s) => s.select);
  const toggleExpanded = useGraphUi((s) => s.toggleExpanded);

  const { nodes, edges } = useMemo(
    () => buildVisibleGraph(ir, expanded, selectedId),
    [ir, expanded, selectedId],
  );

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      select(node.id);
      toggleExpanded(node.id);
    },
    [select, toggleExpanded],
  );

  return (
    <ReactFlowProvider>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          nodesDraggable={false}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <DetailPanel ir={ir} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
