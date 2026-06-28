import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { GraphIR } from "@dev-flow/ir";
import { useGraphUi } from "./state/uiStore";

export function DetailPanel({ ir }: { ir: GraphIR }) {
  const selectedId = useGraphUi((s) => s.selectedId);
  const node = selectedId ? ir.nodes.find((n) => n.id === selectedId) : undefined;
  if (!node) return null;
  const loc = `${node.sourceLocation.file}:${node.sourceLocation.line}`;
  const sig =
    node.kind === "function" && node.signature
      ? `(${node.signature.params.map((p) => `${p.name}: ${p.typeText}`).join(", ")}): ${node.signature.returnText}`
      : null;
  return (
    <Card className="w-72">
      <CardHeader>
        <CardTitle>{node.label}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <div data-testid="detail-kind">{node.kind}</div>
        <div data-testid="detail-loc" className="text-muted-foreground">{loc}</div>
        {sig && <div data-testid="detail-sig" className="mt-1 font-mono text-xs">{sig}</div>}
      </CardContent>
    </Card>
  );
}
