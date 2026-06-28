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
