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
