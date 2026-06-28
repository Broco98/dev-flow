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
