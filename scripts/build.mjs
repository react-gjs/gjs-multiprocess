#!/usr/bin/env node

import { build } from "@ncpa0cpl/nodepack";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const p = (loc) => path.resolve(__dirname, "..", loc);

async function main() {
  try {
    await build({
      target: "ES2022",
      srcDir: p("src"),
      outDir: p("dist"),
      tsConfig: p("tsconfig.json"),
      formats: ["esm"],
      declarations: true,
      compileVendors: "all",
      preset: {
        gjs: true,
      },
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
