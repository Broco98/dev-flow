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
