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
