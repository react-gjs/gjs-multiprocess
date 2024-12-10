#!/usr/bin/env node

import { build } from "@ncpa0cpl/nodepack";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const p = (loc) => path.resolve(__dirname, "..", loc);

const polyfillUrlBanner = /* js */ `
class mpfix_URL {};
const multiprocess_fix = {
  get URL() {
    if(typeof URL === "undefined") {
      return mpfix_URL;
    } else {
      return URL;
    }
  }
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
      decoratorsMetadata: true,
      compileVendors: [
        "path-gjsify",
        "serialize-javascript",
        "lodash",
        "reflect-metadata",
      ],
      replaceImports: {
        randombytes: p("src/shared/random-bytes.ts"),
      },
      preset: {
        gjs: true,
      },
      banner: {
        "serialize-javascript": {
          text: polyfillUrlBanner,
          loader: "copy",
        },
      },
      esbuildOptions: {
        define: {
          URL: "multiprocess_fix.URL",
        },
      },
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
