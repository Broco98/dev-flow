import { z } from "zod";

/** Bump on any breaking change to the IR shape. */
export const IR_SCHEMA_VERSION = "1.0.0" as const;

export const SourceLocation = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
});
export type SourceLocation = z.infer<typeof SourceLocation>;

export const ParamInfo = z.object({ name: z.string(), typeText: z.string() });
export type ParamInfo = z.infer<typeof ParamInfo>;

export const FunctionSignature = z.object({
  params: z.array(ParamInfo),
  returnText: z.string(),
});
export type FunctionSignature = z.infer<typeof FunctionSignature>;

// Spread into each branch so every union member stays a plain ZodObject
// (required by z.discriminatedUnion).
const nodeBase = {
  id: z.string(),
  label: z.string(),
  sourceLocation: SourceLocation,
  parentId: z.string().nullable(),
};

export const GraphNode = z.discriminatedUnion("kind", [
  z.object({ ...nodeBase, kind: z.literal("entrypoint"), method: z.string(), route: z.string() }),
  z.object({ ...nodeBase, kind: z.literal("function"), signature: FunctionSignature.optional() }),
  z.object({ ...nodeBase, kind: z.literal("module") }),
  z.object({ ...nodeBase, kind: z.literal("model"), modelKind: z.enum(["interface", "class", "typeAlias"]) }),
  z.object({ ...nodeBase, kind: z.literal("unresolved") }),
]);
export type GraphNode = z.infer<typeof GraphNode>;

export const GraphEdge = z.object({
  source: z.string(),
  target: z.string(),
  kind: z.enum(["call", "contains", "dataTouch"]),
  meta: z
    .object({ access: z.enum(["read", "write"]).optional(), dataType: z.string().optional() })
    .optional(),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const GraphIR = z.object({
  schemaVersion: z.literal(IR_SCHEMA_VERSION),
  language: z.string(),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  warnings: z.array(z.string()),
});
export type GraphIR = z.infer<typeof GraphIR>;

/** Throws ZodError on invalid input. */
export function parseGraphIR(data: unknown): GraphIR {
  return GraphIR.parse(data);
}
/** Returns { success, data } | { success, error } — never throws. */
export function safeParseGraphIR(data: unknown) {
  return GraphIR.safeParse(data);
}
