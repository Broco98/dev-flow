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
