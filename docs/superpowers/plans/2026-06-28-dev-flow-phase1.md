# dev-flow Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bun monorepo that statically analyzes a TS/JS project (Express entrypoints, call graph, type/model flow) into a versioned graph IR (JSON), and renders it as an interactive drill-down graph in a React/Tailwind/shadcn web viewer.

**Architecture:** Three packages joined by one contract. `@dev-flow/ir` (zod schema + inferred types, browser-safe, depends only on zod) is the contract. `@dev-flow/analyzer` (ts-morph, runs under bun) produces IR. `@dev-flow/viewer` (Vite + React 19 + @xyflow/react + Tailwind v4 + shadcn/ui + zustand) consumes IR and never imports the analyzer. Bun's isolated linker enforces the `ir`-only-depends-on-zod boundary at install time.

**Tech Stack:** bun 1.3.x (workspaces + catalog + `linker="isolated"`) · TypeScript 6 (`moduleResolution: bundler`, exports→src internal packages, no build step for `ir`) · ts-morph 28 · zod 4 · Vite 8 + React 19 · @xyflow/react 12 · Tailwind CSS v4 + shadcn/ui + lucide-react · zustand 5 · Vitest 4.

## Global Constraints

- **bun** is the package manager/runtime. Pin via `.bun-version` (`1.3.14`). Bun's `[install] linker = "isolated"` (bunfig.toml) enforces strict isolation so an undeclared dependency is NOT resolvable — this is how "`ir` depends only on zod" is guaranteed. Catalog pins shared versions ONCE in the root `package.json` `catalog` field; members reference `"catalog:"`.
- A **Node.js ≥ 20.19** runtime must also be present: Vite and Vitest run under Node via their `#!/usr/bin/env node` shebangs (this is the safe path). Bun runs the analyzer's TypeScript directly (`bun run …/cli.ts`) with no tsx.
- **NEVER run `bun test`** (that invokes bun's own runner, not Vitest). Run Vitest via `bunx vitest run` or the package `test` script (`bun run --filter <pkg> test`).
- Catalog values (exact, verified live on npm 2026-06-28): `typescript: 6.0.3`, `vitest: 4.1.9`, `zod: 4.4.3`, `ts-morph: 28.0.0`, `react: 19.2.7`, `react-dom: 19.2.7`, `@types/react: 19.2.17`, `@types/react-dom: 19.2.3`, `@types/node: 26.0.1`, `vite: 8.1.0`, `@vitejs/plugin-react: 6.0.3`, `@xyflow/react: 12.11.1`.
- Viewer-only pins (not cataloged): `tailwindcss: 4.3.1`, `@tailwindcss/vite: 4.3.1`, `lucide-react: 1.21.0`, `zustand: 5.0.14`, `tailwind-merge: 3.6.0`, `clsx: 2.1.1`, `class-variance-authority: 0.7.1`, `@radix-ui/react-slot: 1.3.0`, `tw-animate-css: 1.4.0`, `jsdom: 29.1.1`, `@testing-library/react: 16.3.2`, `@testing-library/dom: ^10.0.0`, `@testing-library/user-event: 14.6.1`, `@testing-library/jest-dom: 6.9.1`. Analyzer fixture pins: `express: 5.2.1`, `@types/express: 5.0.6`.
- **The `ir` package declares ONLY `zod`.** Never add `ts-morph`/`fs`/`path`/Node-only imports to it. The viewer never depends on `@dev-flow/analyzer`.
- Node id schemes are stable strings from `ids.ts` (Task 2) — the ONLY way tasks reference nodes across module boundaries. Reuse the helpers; never hand-format an id.
- ESM everywhere (`"type": "module"`). With `moduleResolution: bundler`, intra-package relative imports use the `.js` extension in TS source (`import { x } from "./ids.js"` → resolves `ids.ts`).
- zustand store state is module-global; every viewer test that touches it MUST reset it in `beforeEach` (shown in the tests).
- Commit messages end with a final line: `KimHyoYeon`.

---

### Task 1: Bun monorepo scaffold + `@dev-flow/ir` schema

**Files:**
- Create: `package.json` (root), `bunfig.toml`, `.bun-version`, `tsconfig.base.json`, `vitest.config.ts` (root)
- Modify: `.gitignore` (add `node_modules`, `bun` artifacts)
- Create: `packages/ir/{package.json, tsconfig.json, vitest.config.ts, src/schema.ts, src/index.ts}`
- Test: `packages/ir/test/schema.test.ts`

**Interfaces — the IR contract every other task consumes (exact types):**
- `IR_SCHEMA_VERSION = "1.0.0"`
- `type SourceLocation = { file: string; line: number }`
- `type ParamInfo = { name: string; typeText: string }`
- `type FunctionSignature = { params: ParamInfo[]; returnText: string }`
- `type GraphNode` = discriminated union on `kind`:
  - `{ kind: "entrypoint"; id; label; sourceLocation; parentId: string|null; method: string; route: string }`
  - `{ kind: "function"; …; signature?: FunctionSignature }`
  - `{ kind: "module"; … }`
  - `{ kind: "model"; …; modelKind: "interface"|"class"|"typeAlias" }`
  - `{ kind: "unresolved"; … }`
- `type GraphEdge = { source: string; target: string; kind: "call"|"contains"|"dataTouch"; meta?: { access?: "read"|"write"; dataType?: string } }`
- `type GraphIR = { schemaVersion: "1.0.0"; language: string; nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] }`
- `parseGraphIR(data: unknown): GraphIR` (throws), `safeParseGraphIR(data: unknown)` (never throws)

- [ ] **Step 1: Create the root manifest with workspaces + catalog**

`package.json`:
```json
{
  "name": "dev-flow",
  "private": true,
  "engines": { "bun": ">=1.3.2", "node": ">=20.19.0" },
  "workspaces": ["packages/*"],
  "catalog": {
    "typescript": "6.0.3",
    "vitest": "4.1.9",
    "zod": "4.4.3",
    "ts-morph": "28.0.0",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@types/node": "26.0.1",
    "vite": "8.1.0",
    "@vitejs/plugin-react": "6.0.3",
    "@xyflow/react": "12.11.1"
  },
  "scripts": {
    "typecheck": "bun run --filter '*' typecheck",
    "test": "vitest run",
    "dev:viewer": "bun run --filter '@dev-flow/viewer' dev"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Enforce isolation + pin bun**

`bunfig.toml`:
```toml
[install]
linker = "isolated"

[run]
elide-lines = 0
```

`.bun-version`:
```
1.3.14
```

- [ ] **Step 3: Shared base tsconfig**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

- [ ] **Step 4: Root Vitest config (Vitest 4 `test.projects`)**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest 4 removed the `workspace` API. Each package owns a vitest.config.ts.
  test: { projects: ["packages/*"] },
});
```

- [ ] **Step 5: Update `.gitignore`**

Append to `.gitignore`:
```
node_modules/
dist/
build/
```

- [ ] **Step 6: Create the `ir` package**

`packages/ir/package.json`:
```json
{
  "name": "@dev-flow/ir",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "catalog:" },
  "devDependencies": { "typescript": "catalog:", "vitest": "catalog:" }
}
```

`packages/ir/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

`packages/ir/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "ir", environment: "node", include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 7: Install**

Run: `bun install`
Expected: workspace links resolve; isolated linker active. No errors.

- [ ] **Step 8: Write the failing schema test**

`packages/ir/test/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { IR_SCHEMA_VERSION, parseGraphIR, safeParseGraphIR, type GraphIR } from "../src/index.js";

const validIR: GraphIR = {
  schemaVersion: IR_SCHEMA_VERSION,
  language: "typescript",
  warnings: [],
  nodes: [
    { kind: "entrypoint", id: "ep:GET /users", label: "GET /users", sourceLocation: { file: "src/app.ts", line: 5 }, parentId: null, method: "GET", route: "/users" },
    { kind: "function", id: "fn:src/users.ts#getUsers", label: "getUsers", sourceLocation: { file: "src/users.ts", line: 12 }, parentId: "module:src/users.ts", signature: { params: [{ name: "req", typeText: "Request" }], returnText: "void" } },
    { kind: "unresolved", id: "unresolved:x.doThing", label: "x.doThing", sourceLocation: { file: "src/a.ts", line: 3 }, parentId: null },
  ],
  edges: [{ source: "ep:GET /users", target: "fn:src/users.ts#getUsers", kind: "call" }],
};

describe("GraphIR schema", () => {
  it("round-trips a valid IR via parse", () => {
    expect(parseGraphIR(validIR)).toEqual(validIR);
  });
  it("rejects an unknown node kind", () => {
    const bad = { ...validIR, nodes: [{ ...validIR.nodes[0], kind: "banana" }] };
    expect(safeParseGraphIR(bad).success).toBe(false);
  });
  it("rejects a wrong schemaVersion", () => {
    expect(safeParseGraphIR({ ...validIR, schemaVersion: "0.9.0" }).success).toBe(false);
  });
  it("requires the warnings array", () => {
    const { warnings, ...noWarnings } = validIR;
    expect(safeParseGraphIR(noWarnings).success).toBe(false);
  });
});
```

- [ ] **Step 9: Run to verify it fails**

Run: `bunx vitest run packages/ir/test/schema.test.ts`
Expected: FAIL — `Cannot find module '../src/index.js'`.

- [ ] **Step 10: Write the schema**

`packages/ir/src/schema.ts`:
```ts
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
```

`packages/ir/src/index.ts`:
```ts
export * from "./schema.js";
```

- [ ] **Step 11: Run to verify it passes**

Run: `bunx vitest run packages/ir/test/schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 12: Typecheck and commit**

Run: `bun run --filter '@dev-flow/ir' typecheck`
Expected: no errors.

```bash
git add package.json bunfig.toml .bun-version tsconfig.base.json vitest.config.ts .gitignore packages/ir bun.lock
git commit -m "feat(ir): bun monorepo scaffold + versioned graph IR zod schema

KimHyoYeon"
```

---

### Task 2: Analyzer scaffold + id/path helpers + module nodes + empty-project test

**Files:**
- Create: `packages/analyzer/{package.json, tsconfig.json, vitest.config.ts, src/ids.ts, src/modules.ts, src/normalize.ts, src/index.ts}`
- Test: `packages/analyzer/test/modules.test.ts`

**Interfaces (reused by every later analyzer task):**
- `toPosixRelative(rootDir, file): string`
- `moduleNodeId(rootDir, file): string` → `"module:<relPosix>"`
- `functionName(decl: Node): string`
- `functionNodeId(rootDir, decl): string` → `"fn:<relPosix>#<name>"`
- `entrypointNodeId(method, route): string` → `"ep:<METHOD> <route>"`
- `modelNodeId(rootDir, file, name): string` → `"model:<relPosix>#<name>"`
- `buildModuleNodes(project, rootDir): { nodes: GraphNode[] }`
- `normalizeIr(ir: GraphIR, rootDir): GraphIR`
- `analyzeProject(project: Project, rootDir): GraphIR`

- [ ] **Step 1: Create analyzer manifest, tsconfig, vitest config**

`packages/analyzer/package.json`:
```json
{
  "name": "@dev-flow/analyzer",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": { "dev-flow-analyze": "./src/cli.ts" },
  "scripts": {
    "start": "bun run src/cli.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@dev-flow/ir": "workspace:*",
    "ts-morph": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "express": "5.2.1",
    "@types/express": "5.0.6"
  }
}
```
> `bin` runs via bun (native TS). Publishing a real npm binary (compiled `dist/cli.js` + shebang) is out of Phase 1 scope.

`packages/analyzer/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test"]
}
```

`packages/analyzer/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "analyzer", environment: "node", include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 2: Install**

Run: `bun install`
Expected: `ts-morph`, `express`, `@types/express` under the analyzer package; `@dev-flow/ir` linked.

- [ ] **Step 3: Write the failing tests (module nodes + empty project)**

`packages/analyzer/test/modules.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { analyzeProject } from "../src/index.js";
import { parseGraphIR } from "@dev-flow/ir";

function inMemoryProject(files: Record<string, string>): Project {
  const p = new Project({ useInMemoryFileSystem: true });
  for (const [path, content] of Object.entries(files)) p.createSourceFile(path, content);
  return p;
}

describe("module nodes", () => {
  it("emits one module node per source file with a relative posix path", () => {
    const project = inMemoryProject({
      "src/app.ts": "export const x = 1;",
      "src/users.ts": "export function getUsers() {}",
    });
    const ir = analyzeProject(project, "/");
    const modules = ir.nodes.filter((n) => n.kind === "module");
    expect(modules.map((m) => m.id).sort()).toEqual(["module:src/app.ts", "module:src/users.ts"]);
    expect(modules.every((m) => m.parentId === null)).toBe(true);
    expect(modules.find((m) => m.id === "module:src/app.ts")!.sourceLocation.file).toBe("src/app.ts");
  });

  it("produces a schema-valid empty IR for an empty project", () => {
    const ir = analyzeProject(inMemoryProject({}), "/");
    expect(ir.nodes).toEqual([]);
    expect(ir.edges).toEqual([]);
    expect(ir.warnings).toEqual([]);
    expect(() => parseGraphIR(ir)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `bunx vitest run packages/analyzer/test/modules.test.ts`
Expected: FAIL — `Cannot find module '../src/index.js'`.

- [ ] **Step 5: Write `ids.ts`**

`packages/analyzer/src/ids.ts`:
```ts
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
```

- [ ] **Step 6: Write `modules.ts`**

`packages/analyzer/src/modules.ts`:
```ts
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
```

- [ ] **Step 7: Write `normalize.ts`**

`packages/analyzer/src/normalize.ts`:
```ts
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
```

- [ ] **Step 8: Write `index.ts` (orchestrator, module nodes only for now)**

`packages/analyzer/src/index.ts`:
```ts
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
```

- [ ] **Step 9: Run to verify it passes**

Run: `bunx vitest run packages/analyzer/test/modules.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: Typecheck and commit**

Run: `bun run --filter '@dev-flow/analyzer' typecheck`
Expected: no errors.

```bash
git add packages/analyzer bun.lock
git commit -m "feat(analyzer): scaffold + id helpers + module nodes + empty-project handling

KimHyoYeon"
```

---

### Task 3: Function nodes + `contains`/`call` edges + `unresolved` nodes (call graph)

**Files:**
- Create: `packages/analyzer/src/resolve.ts`, `packages/analyzer/src/functions.ts`
- Modify: `packages/analyzer/src/index.ts`
- Test: `packages/analyzer/test/functions.test.ts`

**Interfaces:**
- `type CallResolution = { status: "resolved"; decl: Node } | { status: "external" } | { status: "unresolved" }`
- `resolveCall(call, checker): CallResolution`
- `enclosingFunctionDecl(node): Node | undefined`
- `collectFunctionDecls(project): Node[]`
- `buildFunctionGraph(project, rootDir): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] }`

- [ ] **Step 1: Write the failing call-graph test**

`packages/analyzer/test/functions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { analyzeProject } from "../src/index.js";

function inMemoryProject(files: Record<string, string>): Project {
  const p = new Project({ useInMemoryFileSystem: true });
  for (const [path, content] of Object.entries(files)) p.createSourceFile(path, content);
  return p;
}

describe("function graph", () => {
  const project = inMemoryProject({
    "src/users.ts": "export function getUsers() { return []; }",
    "src/app.ts": "import { getUsers } from './users';\nexport function handler() { return getUsers(); }",
  });
  const ir = analyzeProject(project, "/");

  it("creates a function node per declaration", () => {
    const fns = ir.nodes.filter((n) => n.kind === "function").map((n) => n.id);
    expect(fns).toContain("fn:src/users.ts#getUsers");
    expect(fns).toContain("fn:src/app.ts#handler");
  });

  it("links each function to its module via a contains edge", () => {
    expect(ir.edges).toContainEqual({ source: "module:src/users.ts", target: "fn:src/users.ts#getUsers", kind: "contains" });
  });

  it("creates a cross-file call edge handler -> getUsers", () => {
    expect(ir.edges).toContainEqual({ source: "fn:src/app.ts#handler", target: "fn:src/users.ts#getUsers", kind: "call" });
  });

  it("does not create call edges into node_modules / lib", () => {
    expect(ir.edges.some((e) => e.kind === "call" && e.target.includes("lib."))).toBe(false);
  });

  it("represents a truly-dynamic call as an unresolved node + warning", () => {
    const dyn = analyzeProject(
      inMemoryProject({ "src/a.ts": "export function caller(x: any) { x.doThing(); }" }),
      "/",
    );
    expect(dyn.nodes).toContainEqual(
      expect.objectContaining({ kind: "unresolved", id: "unresolved:x.doThing", label: "x.doThing" }),
    );
    expect(dyn.edges).toContainEqual({ source: "fn:src/a.ts#caller", target: "unresolved:x.doThing", kind: "call" });
    expect(dyn.warnings.some((w) => w.includes("x.doThing"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run packages/analyzer/test/functions.test.ts`
Expected: FAIL — function nodes/edges absent.

- [ ] **Step 3: Write `resolve.ts`**

`packages/analyzer/src/resolve.ts`:
```ts
import { CallExpression, Node, type TypeChecker } from "ts-morph";

export type CallResolution =
  | { status: "resolved"; decl: Node }
  | { status: "external" } // resolves into node_modules / lib .d.ts / type-only
  | { status: "unresolved" }; // truly dynamic: no symbol AND no signature

/**
 * Classify a call. Handles fn() and obj.method(), unwraps import/re-export
 * aliases, and uses the checker for exact overloads. (Verified ts-morph 28.)
 */
export function resolveCall(call: CallExpression, checker: TypeChecker): CallResolution {
  const sym = call.getExpression().getSymbol();
  // getAliasedSymbol() returns undefined when NOT an alias -> safe.
  // Do NOT use getImmediatelyAliasedSymbol(): it THROWS on non-aliases.
  const target = sym?.getAliasedSymbol() ?? sym;
  const decl = checker.getResolvedSignature(call)?.getDeclaration() ?? target?.getDeclarations()?.[0];
  if (!decl) return { status: "unresolved" };
  const declFile = decl.getSourceFile();
  if (declFile.isInNodeModules() || declFile.isDeclarationFile()) return { status: "external" };
  if (Node.isFunctionTypeNode(decl) || Node.isMethodSignature(decl)) return { status: "external" };
  return { status: "resolved", decl };
}

/** The nearest enclosing function-like declaration of a node, if any. */
export function enclosingFunctionDecl(node: Node): Node | undefined {
  return node.getFirstAncestor(
    (a) =>
      Node.isFunctionDeclaration(a) ||
      Node.isMethodDeclaration(a) ||
      Node.isArrowFunction(a) ||
      Node.isFunctionExpression(a),
  );
}
```

- [ ] **Step 4: Write `functions.ts`**

`packages/analyzer/src/functions.ts`:
```ts
import { Project, Node, SyntaxKind, type CallExpression } from "ts-morph";
import type { GraphNode, GraphEdge } from "@dev-flow/ir";
import { functionName, functionNodeId, moduleNodeId } from "./ids.js";
import { resolveCall, enclosingFunctionDecl } from "./resolve.js";

/** FunctionDeclarations, named arrow/function-expr initializers, class methods. */
export function collectFunctionDecls(project: Project): Node[] {
  const decls: Node[] = [];
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile()) continue;
    for (const fn of sf.getFunctions()) decls.push(fn);
    for (const v of sf.getVariableDeclarations()) {
      const init = v.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) decls.push(init);
    }
    for (const cls of sf.getClasses()) for (const m of cls.getMethods()) decls.push(m);
  }
  return decls;
}

export function buildFunctionGraph(
  project: Project,
  rootDir: string,
): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] } {
  const checker = project.getTypeChecker();
  const decls = collectFunctionDecls(project);
  const declIds = new Set(decls.map((d) => functionNodeId(rootDir, d)));

  const nodes: GraphNode[] = decls.map((d) => {
    const file = d.getSourceFile().getFilePath();
    return {
      kind: "function",
      id: functionNodeId(rootDir, d),
      label: functionName(d),
      sourceLocation: { file, line: d.getStartLineNumber() },
      parentId: moduleNodeId(rootDir, file),
    };
  });

  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  // contains: module -> function
  for (const d of decls) {
    edges.push({ source: moduleNodeId(rootDir, d.getSourceFile().getFilePath()), target: functionNodeId(rootDir, d), kind: "contains" });
  }

  // call edges + unresolved nodes, de-duplicated
  const seenEdge = new Set<string>();
  const seenUnresolved = new Set<string>();
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile()) continue;
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[]) {
      const fromDecl = enclosingFunctionDecl(call);
      if (!fromDecl) continue;
      const source = functionNodeId(rootDir, fromDecl);
      const res = resolveCall(call, checker);
      if (res.status === "external") continue;

      let target: string;
      if (res.status === "unresolved") {
        const calleeText = call.getExpression().getText();
        target = `unresolved:${calleeText}`;
        if (!seenUnresolved.has(target)) {
          seenUnresolved.add(target);
          nodes.push({
            kind: "unresolved",
            id: target,
            label: calleeText,
            sourceLocation: { file: sf.getFilePath(), line: call.getStartLineNumber() },
            parentId: null,
          });
          warnings.push(`unresolved dynamic call '${calleeText}' at ${sf.getBaseName()}:${call.getStartLineNumber()}`);
        }
      } else {
        target = functionNodeId(rootDir, res.decl);
        if (!declIds.has(target)) continue; // target not a tracked function
      }
      if (source === target) continue;
      const key = `${source}->${target}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push({ source, target, kind: "call" });
    }
  }

  return { nodes, edges, warnings };
}
```

- [ ] **Step 5: Wire into `index.ts`**

In `packages/analyzer/src/index.ts`: add `import { buildFunctionGraph } from "./functions.js";`, add `export { buildFunctionGraph } from "./functions.js";`, and add `collect(buildFunctionGraph(project, rootDir));` immediately after the `collect(buildModuleNodes(...))` line.

- [ ] **Step 6: Run both analyzer test files**

Run: `bunx vitest run packages/analyzer`
Expected: PASS (modules + functions).

- [ ] **Step 7: Typecheck and commit**

Run: `bun run --filter '@dev-flow/analyzer' typecheck`
Expected: no errors.

```bash
git add packages/analyzer
git commit -m "feat(analyzer): function nodes, contains/call edges, unresolved dynamic calls

KimHyoYeon"
```

---

### Task 4: Express entrypoint detector (pluggable `EntrypointDetector`)

**Files:**
- Create: `packages/analyzer/src/express.ts`
- Create: `packages/analyzer/test/fixtures/express-app/{tsconfig.json, src/users.ts, src/app.ts}`
- Modify: `packages/analyzer/src/index.ts`
- Test: `packages/analyzer/test/express.test.ts`

**Interfaces:**
- `interface EntrypointDetector { readonly name: string; detect(project, rootDir): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] } }`
- `expressDetector: EntrypointDetector`
- `defaultDetectors: EntrypointDetector[]` (Express first; the seam for future Next.js/NestJS)

- [ ] **Step 1: Create the on-disk Express fixture**

`packages/analyzer/test/fixtures/express-app/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`packages/analyzer/test/fixtures/express-app/src/users.ts` (lines matter — see Task 5):
```ts
import type { Request, Response } from "express";

export interface User {
  id: number;
  name: string;
}

export function listUsers(): User[] {
  return [];
}

export function getUsers(_req: Request, res: Response): void {
  res.json(listUsers());
}
```

`packages/analyzer/test/fixtures/express-app/src/app.ts`:
```ts
import express from "express";
import { getUsers } from "./users.js";

const app = express();
app.get("/users", getUsers);

export default app;
```

- [ ] **Step 2: Write the failing entrypoint test**

`packages/analyzer/test/express.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "fixtures/express-app");

describe("express entrypoints", () => {
  const project = new Project({ tsConfigFilePath: resolve(fixtureDir, "tsconfig.json") });
  const ir = analyzeProject(project, fixtureDir);

  it("detects GET /users as an entrypoint node", () => {
    const ep = ir.nodes.find((n) => n.kind === "entrypoint");
    expect(ep).toMatchObject({ kind: "entrypoint", method: "GET", route: "/users", label: "GET /users" });
  });

  it("links the entrypoint to its handler function via a call edge", () => {
    expect(ir.edges).toContainEqual({ source: "ep:GET /users", target: "fn:src/users.ts#getUsers", kind: "call" });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bunx vitest run packages/analyzer/test/express.test.ts`
Expected: FAIL — no entrypoint node.

- [ ] **Step 4: Write `express.ts`**

`packages/analyzer/src/express.ts`:
```ts
import { Project, Node, SyntaxKind, type CallExpression } from "ts-morph";
import type { GraphNode, GraphEdge } from "@dev-flow/ir";
import { entrypointNodeId, functionNodeId } from "./ids.js";

export interface EntrypointDetector {
  readonly name: string;
  detect(project: Project, rootDir: string): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] };
}

const ROUTE_METHODS = new Set(["get", "post", "put", "delete", "patch", "all", "options", "head"]);

/** Resolve a route handler argument to its function declaration node. */
function resolveHandler(arg: Node): Node | undefined {
  if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) return arg; // inline literal
  const id = arg.asKind(SyntaxKind.Identifier);
  if (!id) return undefined;
  let defs: Node[] = [];
  try {
    defs = id.getDefinitionNodes();
  } catch {
    return undefined;
  }
  for (const def of defs) {
    if (Node.isFunctionDeclaration(def)) return def;
    if (Node.isVariableDeclaration(def)) {
      const init = def.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) return init;
    }
  }
  return undefined;
}

export const expressDetector: EntrypointDetector = {
  name: "express",
  detect(project, rootDir) {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const warnings: string[] = [];

    for (const sf of project.getSourceFiles()) {
      if (sf.isDeclarationFile() || sf.isInNodeModules()) continue;
      for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[]) {
        const pae = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
        if (!pae) continue;
        const method = pae.getName();
        if (!ROUTE_METHODS.has(method)) continue;

        const args = call.getArguments();
        const first = args[0];
        const lit =
          first?.asKind(SyntaxKind.StringLiteral) ?? first?.asKind(SyntaxKind.NoSubstitutionTemplateLiteral);
        const route = lit?.getLiteralValue();

        const handlerArgs = args
          .slice(route === undefined ? 0 : 1)
          .filter((a) => Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isIdentifier(a));
        if (handlerArgs.length === 0) continue; // settings getter app.get('view engine'), app.use(mw), etc.

        if (route === undefined) {
          warnings.push(`skipped ${method} route with non-literal path at ${sf.getBaseName()}:${call.getStartLineNumber()}`);
          continue;
        }

        const id = entrypointNodeId(method, route);
        nodes.push({
          kind: "entrypoint",
          id,
          label: `${method.toUpperCase()} ${route}`,
          sourceLocation: { file: sf.getFilePath(), line: call.getStartLineNumber() },
          parentId: null,
          method: method.toUpperCase(),
          route,
        });
        for (const arg of handlerArgs) {
          const handler = resolveHandler(arg);
          if (handler) edges.push({ source: id, target: functionNodeId(rootDir, handler), kind: "call" });
        }
      }
    }

    return { nodes, edges, warnings };
  },
};

export const defaultDetectors: EntrypointDetector[] = [expressDetector];
```

- [ ] **Step 5: Wire into `index.ts`**

In `packages/analyzer/src/index.ts`: add `import { defaultDetectors } from "./express.js";`, add `export { defaultDetectors, expressDetector, type EntrypointDetector } from "./express.js";`, and after the `collect(buildFunctionGraph(...))` line add:
```ts
  for (const detector of defaultDetectors) collect(detector.detect(project, rootDir));
```

- [ ] **Step 6: Run all analyzer tests**

Run: `bunx vitest run packages/analyzer`
Expected: PASS (modules, functions, express).

- [ ] **Step 7: Typecheck and commit**

Run: `bun run --filter '@dev-flow/analyzer' typecheck`
Expected: no errors.

```bash
git add packages/analyzer
git commit -m "feat(analyzer): pluggable EntrypointDetector + Express implementation

KimHyoYeon"
```

---

### Task 5: Type signatures + model nodes + `dataTouch` edges

**Files:**
- Create: `packages/analyzer/src/types-flow.ts`
- Modify: `packages/analyzer/src/index.ts`
- Test: `packages/analyzer/test/types-flow.test.ts`

**Interfaces:**
- `extractSignature(decl): FunctionSignature | undefined`
- `buildTypesAndModels(project, rootDir): { signatures: Map<string, FunctionSignature>; modelNodes: GraphNode[]; dataEdges: GraphEdge[] }`

- [ ] **Step 1: Write the failing types-flow test**

`packages/analyzer/test/types-flow.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "fixtures/express-app");

describe("type & model flow", () => {
  const project = new Project({ tsConfigFilePath: resolve(fixtureDir, "tsconfig.json") });
  const ir = analyzeProject(project, fixtureDir);

  it("attaches a signature to a function node", () => {
    const fn = ir.nodes.find((n) => n.id === "fn:src/users.ts#getUsers");
    expect(fn).toMatchObject({
      kind: "function",
      signature: {
        params: [
          { name: "_req", typeText: "Request" },
          { name: "res", typeText: "Response" },
        ],
        returnText: "void",
      },
    });
  });

  it("emits a model node for the exported User interface", () => {
    expect(ir.nodes).toContainEqual(
      expect.objectContaining({ kind: "model", id: "model:src/users.ts#User", label: "User", modelKind: "interface" }),
    );
  });

  it("emits a read dataTouch edge from listUsers to the User model", () => {
    expect(ir.edges).toContainEqual({
      source: "fn:src/users.ts#listUsers",
      target: "model:src/users.ts#User",
      kind: "dataTouch",
      meta: { access: "read", dataType: "User" },
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run packages/analyzer/test/types-flow.test.ts`
Expected: FAIL — no signature/model/dataTouch.

- [ ] **Step 3: Write `types-flow.ts`**

`packages/analyzer/src/types-flow.ts`:
```ts
import { Project, Node, TypeFormatFlags, type Type } from "ts-morph";
import type { FunctionSignature, GraphNode, GraphEdge } from "@dev-flow/ir";
import { functionNodeId, modelNodeId } from "./ids.js";
import { collectFunctionDecls } from "./functions.js";

const FLAGS = TypeFormatFlags.NoTruncation | TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/** Readable param + return types. Prefers the as-written annotation. */
export function extractSignature(decl: Node): FunctionSignature | undefined {
  if (
    !Node.isFunctionDeclaration(decl) &&
    !Node.isArrowFunction(decl) &&
    !Node.isMethodDeclaration(decl) &&
    !Node.isFunctionExpression(decl)
  ) {
    return undefined;
  }
  const params = decl.getParameters().map((p) => ({
    name: p.getName(),
    typeText: p.getTypeNode()?.getText() ?? p.getType().getText(p, FLAGS),
  }));
  const returnText = decl.getReturnTypeNode()?.getText() ?? decl.getReturnType().getText(decl, FLAGS);
  return { params, returnText };
}

/** Unwrap Promise<T> and T[] to the underlying named type's symbol name. */
function unwrapModelName(t: Type): string | undefined {
  let cur = t;
  if (cur.getSymbol()?.getName() === "Promise") {
    const arg = cur.getTypeArguments()[0];
    if (arg) cur = arg;
  }
  if (cur.isArray()) cur = cur.getArrayElementTypeOrThrow();
  return (cur.getSymbol() ?? cur.getAliasSymbol())?.getName();
}

export function buildTypesAndModels(
  project: Project,
  rootDir: string,
): { signatures: Map<string, FunctionSignature>; modelNodes: GraphNode[]; dataEdges: GraphEdge[] } {
  const signatures = new Map<string, FunctionSignature>();
  for (const decl of collectFunctionDecls(project)) {
    const sig = extractSignature(decl);
    if (sig) signatures.set(functionNodeId(rootDir, decl), sig);
  }

  const modelNodes: GraphNode[] = [];
  const modelIdByName = new Map<string, string>();
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile() || sf.isInNodeModules()) continue;
    const file = sf.getFilePath();
    const add = (name: string, modelKind: "interface" | "class" | "typeAlias", line: number) => {
      const id = modelNodeId(rootDir, file, name);
      modelNodes.push({ kind: "model", id, label: name, sourceLocation: { file, line }, parentId: null, modelKind });
      modelIdByName.set(name, id);
    };
    for (const i of sf.getInterfaces()) if (i.isExported()) add(i.getName(), "interface", i.getStartLineNumber());
    for (const t of sf.getTypeAliases()) if (t.isExported()) add(t.getName(), "typeAlias", t.getStartLineNumber());
    for (const c of sf.getClasses()) {
      const name = c.getName();
      if (name && c.isExported()) add(name, "class", c.getStartLineNumber());
    }
  }

  const dataEdges: GraphEdge[] = [];
  for (const decl of collectFunctionDecls(project)) {
    if (!Node.isFunctionDeclaration(decl) && !Node.isArrowFunction(decl) && !Node.isMethodDeclaration(decl)) continue;
    const modelName = unwrapModelName(decl.getReturnType());
    if (!modelName) continue;
    const target = modelIdByName.get(modelName);
    if (!target) continue;
    dataEdges.push({
      source: functionNodeId(rootDir, decl),
      target,
      kind: "dataTouch",
      meta: { access: "read", dataType: modelName },
    });
  }

  return { signatures, modelNodes, dataEdges };
}
```

- [ ] **Step 4: Wire into `index.ts`**

In `packages/analyzer/src/index.ts`: add `import { buildTypesAndModels } from "./types-flow.js";`, add `export { buildTypesAndModels } from "./types-flow.js";`, and AFTER the detector loop but BEFORE `GraphIR.parse`, add:
```ts
  const flow = buildTypesAndModels(project, rootDir);
  for (const n of nodes) {
    if (n.kind === "function") {
      const sig = flow.signatures.get(n.id);
      if (sig) n.signature = sig;
    }
  }
  nodes.push(...flow.modelNodes);
  edges.push(...flow.dataEdges);
```

- [ ] **Step 5: Run all analyzer tests**

Run: `bunx vitest run packages/analyzer`
Expected: PASS (modules, functions, express, types-flow).

- [ ] **Step 6: Typecheck and commit**

Run: `bun run --filter '@dev-flow/analyzer' typecheck`
Expected: no errors.

```bash
git add packages/analyzer
git commit -m "feat(analyzer): function signatures, model nodes, dataTouch edges

KimHyoYeon"
```

---

### Task 6: Analyzer CLI + golden IR file snapshot

**Files:**
- Create: `packages/analyzer/src/cli.ts`
- Test: `packages/analyzer/test/snapshot.test.ts`
- Generated: `packages/analyzer/test/__snapshots__/express-app.ir.json`

- [ ] **Step 1: Write `cli.ts`**

`packages/analyzer/src/cli.ts`:
```ts
#!/usr/bin/env bun
import { Project } from "ts-morph";
import { resolve, dirname } from "node:path";
import { analyzeProject } from "./index.js";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: dev-flow-analyze <path-to-tsconfig.json>");
  process.exit(1);
}
const tsConfigFilePath = resolve(process.cwd(), arg);
const rootDir = dirname(tsConfigFilePath);
const ir = analyzeProject(new Project({ tsConfigFilePath }), rootDir);
if (ir.warnings.length) console.error(`[dev-flow] ${ir.warnings.length} warning(s):\n  ${ir.warnings.join("\n  ")}`);
process.stdout.write(`${JSON.stringify(ir, null, 2)}\n`);
```

- [ ] **Step 2: Write the failing full-IR snapshot test**

`packages/analyzer/test/snapshot.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "fixtures/express-app");

describe("full IR snapshot", () => {
  it("matches the committed golden IR for the express fixture", async () => {
    const ir = analyzeProject(new Project({ tsConfigFilePath: resolve(fixtureDir, "tsconfig.json") }), fixtureDir);
    await expect(`${JSON.stringify(ir, null, 2)}\n`).toMatchFileSnapshot("./__snapshots__/express-app.ir.json");
  });
});
```

- [ ] **Step 3: Run to generate + verify the snapshot**

Run: `bunx vitest run packages/analyzer/test/snapshot.test.ts`
Expected: PASS — Vitest writes `test/__snapshots__/express-app.ir.json`. Open it and confirm: `warnings: []`; `GET /users` entrypoint at `src/app.ts:5`; `getUsers`(line 12)/`listUsers`(line 8) function nodes with signatures; `User` model at `src/users.ts:3`; `contains`/`call`/`dataTouch` edges; all paths relative+posix; nodes sorted by id.

- [ ] **Step 4: Verify the CLI runs under bun**

Run: `bun run packages/analyzer/src/cli.ts packages/analyzer/test/fixtures/express-app/tsconfig.json`
Expected: prints the IR JSON to stdout, exit 0.

- [ ] **Step 5: Commit (including the golden snapshot)**

```bash
git add packages/analyzer/src/cli.ts packages/analyzer/test/snapshot.test.ts packages/analyzer/test/__snapshots__/express-app.ir.json
git commit -m "feat(analyzer): bun CLI + golden IR file snapshot

KimHyoYeon"
```

---

### Task 7: Viewer scaffold (Vite + Tailwind v4 + shadcn + zustand) + render entrypoints only

**Files:**
- Create: `packages/viewer/{package.json, tsconfig.json, tsconfig.node.json, vite.config.ts, vitest.config.ts, index.html, components.json}`
- Create: `packages/viewer/src/{index.css, lib/utils.ts, state/uiStore.ts, ir-graph.ts, nodes.tsx, Viewer.tsx, main.tsx}`
- Generated by shadcn CLI: `packages/viewer/src/components/ui/{card.tsx, button.tsx}`
- Create: `packages/viewer/public/graph.json`
- Create: `packages/viewer/test/{setup.ts, fixtures/express-app.ir.json, viewer.test.tsx}`

**Interfaces:**
- `useGraphUi` (zustand store): `{ selectedId: string|null; expanded: Set<string>; select(id); toggleExpanded(id) }`
- `buildVisibleGraph(ir, expanded, selectedId): { nodes: RFNode[]; edges: RFEdge[] }`
- `computeVisibleIds(ir, expanded): Set<string>`
- `<Viewer ir={unknown} />`

- [ ] **Step 1: Create the viewer manifest (all deps declared for the isolated linker)**

`packages/viewer/package.json`:
```json
{
  "name": "@dev-flow/viewer",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@dev-flow/ir": "workspace:*",
    "@xyflow/react": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "zustand": "5.0.14",
    "lucide-react": "1.21.0",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "3.6.0",
    "tw-animate-css": "1.4.0",
    "@radix-ui/react-slot": "1.3.0"
  },
  "devDependencies": {
    "vite": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "tailwindcss": "4.3.1",
    "@tailwindcss/vite": "4.3.1",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "jsdom": "29.1.1",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@types/node": "catalog:",
    "@testing-library/react": "16.3.2",
    "@testing-library/dom": "^10.0.0",
    "@testing-library/user-event": "14.6.1",
    "@testing-library/jest-dom": "6.9.1"
  }
}
```

- [ ] **Step 2: tsconfig with `@/*` alias (required by shadcn)**

`packages/viewer/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "test", "vite.config.ts", "vitest.config.ts"]
}
```

`packages/viewer/tsconfig.node.json` (referenced by some shadcn tooling; harmless if unused):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Vite + Vitest config (Tailwind v4 plugin + `@` alias)**

`packages/viewer/vite.config.ts`:
```ts
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
```

`packages/viewer/vitest.config.ts`:
```ts
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    name: "viewer",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.tsx", "test/**/*.test.tsx"],
  },
});
```

- [ ] **Step 4: index.html + Tailwind entry CSS + cn() + components.json**

`packages/viewer/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>dev-flow</title>
  </head>
  <body>
    <div id="root" style="width: 100vw; height: 100vh"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/viewer/src/index.css` (Tailwind v4 + shadcn tokens):
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

`packages/viewer/src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`packages/viewer/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/index.css", "baseColor": "zinc", "cssVariables": true, "prefix": "" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 5: Install + generate the shadcn components**

Run: `bun install`
Run: `bunx shadcn@latest add card button`
Expected: creates `src/components/ui/card.tsx` and `src/components/ui/button.tsx` (the CLI sees `components.json` + the `@` alias and writes the components; on bun no `--force` is needed). If the CLI prompts to overwrite `index.css`, decline — keep the file from Step 4.

> If `bunx shadcn@latest add` cannot run in this environment, the only hard requirement for Phase 1 tests is `@/components/ui/card.tsx` exporting `Card`, `CardHeader`, `CardTitle`, `CardContent`. The shadcn CLI is the supported source for that file.

- [ ] **Step 6: zustand store**

`packages/viewer/src/state/uiStore.ts`:
```ts
import { create } from "zustand"; // v5: named import only (no default export)

interface GraphUiState {
  selectedId: string | null;
  expanded: Set<string>;
  select: (id: string | null) => void;
  toggleExpanded: (id: string) => void;
}

export const useGraphUi = create<GraphUiState>()((set) => ({
  selectedId: null,
  expanded: new Set<string>(),
  select: (id) => set({ selectedId: id }),
  toggleExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expanded); // new ref -> triggers re-render
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expanded: next };
    }),
}));
```

- [ ] **Step 7: IR → React Flow derivation**

`packages/viewer/src/ir-graph.ts`:
```ts
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
```

- [ ] **Step 8: Custom node components (lucide icons)**

`packages/viewer/src/nodes.tsx`:
```tsx
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
```

- [ ] **Step 9: Viewer component (no detail panel yet)**

`packages/viewer/src/Viewer.tsx`:
```tsx
import { useMemo, useCallback } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useShallow } from "zustand/react/shallow";
import { safeParseGraphIR, type GraphIR } from "@dev-flow/ir";
import { buildVisibleGraph } from "./ir-graph";
import { nodeTypes } from "./nodes";
import { useGraphUi } from "./state/uiStore";

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
      <div style={{ width: "100%", height: "100%" }}>
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
      </div>
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 10: `main.tsx` (graceful missing-graph.json) + public graph**

`packages/viewer/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Viewer } from "./Viewer";
import "./index.css";

async function bootstrap() {
  const root = createRoot(document.getElementById("root")!);
  try {
    const res = await fetch("/graph.json");
    if (!res.ok) throw new Error(`graph.json ${res.status}`);
    const ir: unknown = await res.json();
    root.render(
      <StrictMode>
        <Viewer ir={ir} />
      </StrictMode>,
    );
  } catch {
    root.render(
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        graph.json을 찾을 수 없습니다. 분석기 출력(IR JSON)을 <code>packages/viewer/public/graph.json</code> 에 두세요.
      </div>,
    );
  }
}
void bootstrap();
```

Create `packages/viewer/public/graph.json` as a copy of the fixture (Step 12) so `bun run dev:viewer` shows something. (For real use, drop analyzer output here.)

- [ ] **Step 11: Test setup (jest-dom + mockReactFlow with `globalThis`)**

`packages/viewer/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @xyflow/react renders nothing in jsdom without these measurement polyfills.
// (Official React Flow testing guide; uses globalThis so tsc needs no @types/node global.)
class ResizeObserverMock {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    setTimeout(() => this.cb([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver), 0);
  }
  unobserve() {}
  disconnect() {}
}
class DOMMatrixReadOnlyMock {
  m22: number;
  constructor(t?: string) {
    const s = t?.match(/scale\(([\d.]+)\)/)?.[1];
    this.m22 = s !== undefined ? +s : 1;
  }
}
let init = false;
function mockReactFlow() {
  if (init) return;
  init = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;
  Object.defineProperties(globalThis.HTMLElement.prototype, {
    offsetHeight: { get() { return parseFloat((this as HTMLElement).style.height) || 1; } },
    offsetWidth: { get() { return parseFloat((this as HTMLElement).style.width) || 1; } },
  });
  (globalThis.SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
}
mockReactFlow();
afterEach(() => cleanup());
```

- [ ] **Step 12: Viewer fixture IR (lines match the analyzer's `express-app` output)**

`packages/viewer/test/fixtures/express-app.ir.json`:
```json
{
  "schemaVersion": "1.0.0",
  "language": "typescript",
  "warnings": [],
  "nodes": [
    { "kind": "entrypoint", "id": "ep:GET /users", "label": "GET /users", "sourceLocation": { "file": "src/app.ts", "line": 5 }, "parentId": null, "method": "GET", "route": "/users" },
    { "kind": "module", "id": "module:src/app.ts", "label": "app.ts", "sourceLocation": { "file": "src/app.ts", "line": 1 }, "parentId": null },
    { "kind": "module", "id": "module:src/users.ts", "label": "users.ts", "sourceLocation": { "file": "src/users.ts", "line": 1 }, "parentId": null },
    { "kind": "function", "id": "fn:src/users.ts#getUsers", "label": "getUsers", "sourceLocation": { "file": "src/users.ts", "line": 12 }, "parentId": "module:src/users.ts", "signature": { "params": [{ "name": "_req", "typeText": "Request" }, { "name": "res", "typeText": "Response" }], "returnText": "void" } },
    { "kind": "function", "id": "fn:src/users.ts#listUsers", "label": "listUsers", "sourceLocation": { "file": "src/users.ts", "line": 8 }, "parentId": "module:src/users.ts", "signature": { "params": [], "returnText": "User[]" } },
    { "kind": "model", "id": "model:src/users.ts#User", "label": "User", "sourceLocation": { "file": "src/users.ts", "line": 3 }, "parentId": null, "modelKind": "interface" }
  ],
  "edges": [
    { "source": "module:src/users.ts", "target": "fn:src/users.ts#getUsers", "kind": "contains" },
    { "source": "module:src/users.ts", "target": "fn:src/users.ts#listUsers", "kind": "contains" },
    { "source": "ep:GET /users", "target": "fn:src/users.ts#getUsers", "kind": "call" },
    { "source": "fn:src/users.ts#getUsers", "target": "fn:src/users.ts#listUsers", "kind": "call" },
    { "source": "fn:src/users.ts#listUsers", "target": "model:src/users.ts#User", "kind": "dataTouch", "meta": { "access": "read", "dataType": "User" } }
  ]
}
```

Copy this file to `packages/viewer/public/graph.json` as well.

- [ ] **Step 13: Write the failing viewer test**

`packages/viewer/test/viewer.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Viewer } from "../src/Viewer";
import { useGraphUi } from "../src/state/uiStore";
import fixtureIr from "./fixtures/express-app.ir.json";

const sized = (ui: ReactNode) => <div style={{ width: 800, height: 600 }}>{ui}</div>;

beforeEach(() => useGraphUi.setState({ selectedId: null, expanded: new Set<string>() }));

describe("Viewer", () => {
  it("shows only entrypoint nodes at the top level", async () => {
    render(sized(<Viewer ir={fixtureIr} />));
    expect(await screen.findByText("GET /users")).toBeInTheDocument();
    expect(screen.queryByText("getUsers")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 14: Run the viewer test to verify it passes**

Run: `bunx vitest run packages/viewer/test/viewer.test.tsx`
Expected: PASS — `GET /users` found; `getUsers` hidden.

- [ ] **Step 15: Typecheck and commit**

Run: `bun run --filter '@dev-flow/viewer' typecheck`
Expected: no errors.

```bash
git add packages/viewer bun.lock
git commit -m "feat(viewer): Vite+Tailwind+shadcn+zustand scaffold; render entrypoints from IR

KimHyoYeon"
```

---

### Task 8: Viewer drill-down (expand/collapse on click)

**Files:**
- Test: `packages/viewer/test/drilldown.test.tsx`

> No source changes are needed: `Viewer.tsx`'s `onNodeClick` already calls `toggleExpanded`, and `buildVisibleGraph` reveals call/dataTouch children of expanded nodes. This task verifies that behavior end-to-end (and exists as its own reviewer gate).

- [ ] **Step 1: Write the failing drill-down test**

`packages/viewer/test/drilldown.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Viewer } from "../src/Viewer";
import { useGraphUi } from "../src/state/uiStore";
import fixtureIr from "./fixtures/express-app.ir.json";

const sized = (ui: ReactNode) => <div style={{ width: 800, height: 600 }}>{ui}</div>;

beforeEach(() => useGraphUi.setState({ selectedId: null, expanded: new Set<string>() }));

describe("drill-down", () => {
  it("reveals the handler function when its entrypoint is clicked", async () => {
    const user = userEvent.setup();
    render(sized(<Viewer ir={fixtureIr} />));
    const ep = await screen.findByText("GET /users");
    expect(screen.queryByText("getUsers")).not.toBeInTheDocument();
    await user.click(ep);
    expect(await screen.findByText("getUsers")).toBeInTheDocument();
  });

  it("hides the handler again when the entrypoint is clicked twice", async () => {
    const user = userEvent.setup();
    render(sized(<Viewer ir={fixtureIr} />));
    const ep = await screen.findByText("GET /users");
    await user.click(ep);
    expect(await screen.findByText("getUsers")).toBeInTheDocument();
    await user.click(ep);
    expect(screen.queryByText("getUsers")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `bunx vitest run packages/viewer/test/drilldown.test.tsx`
Expected: PASS (2 tests). If FAIL, re-check that `Viewer.tsx onNodeClick` calls `toggleExpanded` and that `buildVisibleGraph` uses `computeVisibleIds`.

- [ ] **Step 3: Commit**

```bash
git add packages/viewer/test/drilldown.test.tsx
git commit -m "test(viewer): click-to-expand drill-down over call edges

KimHyoYeon"
```

---

### Task 9: Detail panel (file:line + signature) + model reveal + full sweep

**Files:**
- Create: `packages/viewer/src/DetailPanel.tsx`
- Modify: `packages/viewer/src/Viewer.tsx` (mount the panel)
- Test: `packages/viewer/test/detail.test.tsx`

**Interfaces:**
- `<DetailPanel ir={GraphIR} />` — reads `useGraphUi().selectedId`, renders the selected node's `kind`, `file:line`, and (for functions) signature inside a shadcn `Card`.

- [ ] **Step 1: Write the failing detail/model test**

`packages/viewer/test/detail.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Viewer } from "../src/Viewer";
import { useGraphUi } from "../src/state/uiStore";
import fixtureIr from "./fixtures/express-app.ir.json";

const sized = (ui: ReactNode) => <div style={{ width: 800, height: 600 }}>{ui}</div>;

beforeEach(() => useGraphUi.setState({ selectedId: null, expanded: new Set<string>() }));

describe("detail panel + model reveal", () => {
  it("shows the selected entrypoint's file:line in the detail panel", async () => {
    const user = userEvent.setup();
    render(sized(<Viewer ir={fixtureIr} />));
    await user.click(await screen.findByText("GET /users"));
    expect(await screen.findByTestId("detail-loc")).toHaveTextContent("src/app.ts:5");
    expect(screen.getByTestId("detail-kind")).toHaveTextContent("entrypoint");
  });

  it("shows a function's signature when selected, and reveals a touched model", async () => {
    const user = userEvent.setup();
    render(sized(<Viewer ir={fixtureIr} />));
    await user.click(await screen.findByText("GET /users")); // expand -> getUsers
    await user.click(await screen.findByText("getUsers")); // select + expand -> listUsers
    expect(await screen.findByTestId("detail-sig")).toHaveTextContent("_req: Request");
    await user.click(await screen.findByText("listUsers")); // expand -> User model (dataTouch)
    expect(await screen.findByText("User")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run packages/viewer/test/detail.test.tsx`
Expected: FAIL — no `detail-loc` testid (panel not mounted).

- [ ] **Step 3: Write `DetailPanel.tsx`**

`packages/viewer/src/DetailPanel.tsx`:
```tsx
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
```

- [ ] **Step 4: Mount the panel in `Viewer.tsx`**

In `packages/viewer/src/Viewer.tsx`: add the import `import { DetailPanel } from "./DetailPanel";` and replace the `<div style={{ width: "100%", height: "100%" }}>…</div>` wrapper inside `FlowInner`'s return with:
```tsx
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
```

- [ ] **Step 5: Run the full viewer suite**

Run: `bunx vitest run packages/viewer`
Expected: PASS (viewer, drilldown, detail).

- [ ] **Step 6: Typecheck, full sweep, commit**

Run: `bun run --filter '@dev-flow/viewer' typecheck`
Run: `bun run typecheck && bun run test`
Expected: all packages typecheck; all Vitest projects pass.

```bash
git add packages/viewer
git commit -m "feat(viewer): detail panel (file:line + signature) + model reveal

KimHyoYeon"
```

---

## Done criteria (Phase 1)

- From a clean checkout: `bun install && bun run typecheck && bun run test` is green.
- `bun run packages/analyzer/src/cli.ts <path/to/tsconfig.json>` prints normalized IR JSON (with `warnings`) for any TS project.
- `bun run dev:viewer`, with an analyzer-produced `packages/viewer/public/graph.json`, shows entrypoints; clicking drills down call→function→model, the detail panel shows `file:line` + signature, and dynamic calls appear as `unresolved` nodes.
- Bun's isolated linker is active: `cd packages/analyzer && bun -e 'require.resolve("zod")'` throws (analyzer never declared zod) — proving the `ir`-only-depends-on-zod boundary.
- Analyzer and viewer share zero runtime code — only `@dev-flow/ir`.

## Out of scope (later phases, per the spec)

Multi-language analyzers; Tauri desktop shell + source-jump; true value-level dataflow; non-Express frameworks; ORM (TypeORM `@Entity` / Prisma) dataTouch detection (Phase 1 ships return-type→model linkage only); incremental/watch analysis; auto-layout (dagre/elk); visual module grouping via `contains` edges (the analyzer emits module→function `contains`; the schema also permits module→module, deferred); dark mode.
