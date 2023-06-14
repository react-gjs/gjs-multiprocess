#!/usr/bin/env node

import { build } from "@ncpa0cpl/nodepack";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const p = (loc) => path.resolve(__dirname, "..", loc);

const polyfillUrlBanner = /* js */ `
if(typeof URL === "undefined") {
  class URL {};
  Object.defineProperty(globalThis, "URL", {
    value: URL,
  });
}
`.trim();

async function main() {
  try {
    await build({
      target: "ES2022",
      srcDir: p("src"),
      outDir: p("dist"),
      tsConfig: p("tsconfig.json"),
      formats: ["esm"],
      declarations: true,
      compileVendors: ["path-gjsify", "serialize-javascript", "lodash"],
      replaceImports: {
        randombytes: p("src/shared/random-bytes.ts"),
      },
      preset: {
        gjs: true,
      },
    });

    const sjModule = await readFile(
      p("dist/esm/_vendors/serialize-javascript.mjs"),
      "utf-8"
    );

    await writeFile(
      p("dist/esm/_vendors/serialize-javascript.mjs"),
      `${polyfillUrlBanner}\n${sjModule}`
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
