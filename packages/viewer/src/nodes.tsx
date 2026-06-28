import { memo, type ReactNode } from "react";
import { Handle, Position, type NodeProps, type Node as RFNode } from "@xyflow/react";
import { Webhook, Braces, Database, FileCode, CircleHelp, type LucideIcon } from "lucide-react";
import type { FlowNodeData } from "./ir-graph";

type DFNode = RFNode<FlowNodeData>;

function Shell({ Icon, color, children }: { Icon: LucideIcon; color: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: 8,
        border: `1px solid ${color}`,
        background: "#fff",
        fontSize: 12,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Icon size={14} color={color} />
      <div style={{ overflow: "hidden" }}>{children}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const EntrypointNode = memo(({ data }: NodeProps<DFNode>) => (
  <Shell Icon={Webhook} color="#6366f1">
    <strong>{data.ir.label}</strong>
  </Shell>
));
const FunctionNode = memo(({ data }: NodeProps<DFNode>) => {
  const n = data.ir;
  const sig =
    n.kind === "function" && n.signature
      ? `(${n.signature.params.map((p) => `${p.name}: ${p.typeText}`).join(", ")}): ${n.signature.returnText}`
      : "";
  return (
    <Shell Icon={Braces} color="#0ea5e9">
      <div>{n.label}</div>
      {sig && <div style={{ color: "#64748b", fontSize: 10 }}>{sig}</div>}
    </Shell>
  );
});
const ModelNode = memo(({ data }: NodeProps<DFNode>) => (
  <Shell Icon={Database} color="#22c55e">
    {data.ir.label}
  </Shell>
));
const ModuleNode = memo(({ data }: NodeProps<DFNode>) => (
  <Shell Icon={FileCode} color="#9ca3af">
    {data.ir.label}
  </Shell>
));
const UnresolvedNode = memo(({ data }: NodeProps<DFNode>) => (
  <Shell Icon={CircleHelp} color="#f59e0b">
    {data.ir.label}
  </Shell>
));

export const nodeTypes = {
  entrypoint: EntrypointNode,
  fn: FunctionNode,
  model: ModelNode,
  module: ModuleNode,
  unresolved: UnresolvedNode,
};
