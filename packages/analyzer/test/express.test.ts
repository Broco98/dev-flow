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
