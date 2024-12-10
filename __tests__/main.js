import { startServer } from "../dist/esm/index.mjs";
import { replaceCyclicRefs } from "../dist/esm/shared/cyclic-refs.mjs";
import { printError } from "../dist/esm/shared/print-error.mjs";

/**
 * @typedef {import("../src/server/client-proxy.js").ClientProxy<{
 *     bumpInternalCounter: () => void;
 *   }>} ClientProxy
 */

async function main() {
  const server = await startServer("org.multiprocess.test");

  try {
    const serverApi = {
      loopback: (str) => str + str,
    };
    /** @type {ClientProxy} */
    const client1 = await server.createClient(
      "./__tests__/worker.js",
      serverApi,
    );

    const obj = {
      foo: [1, 2, 3],
      bar: function bar() {
        return "bar";
      },
      baz: new Set([1, 2, 3]),
      qux: {
        obj: null,
      },
    };
    obj.qux.obj = obj;
    obj.foo[3] = obj.qux;

    const loopedObj = await client1.invoke.loopback(obj);

    console.log(
      replaceCyclicRefs(loopedObj, (ref) => {
        return `${["$", ref.firstPath].join(".")}`;
      }),
    );
  } catch (e) {
    console.log("Worker failed with:", e);
  } finally {
    server.close();
  }
}

main()
  .catch((err) => {
    printError(err);
  })
  .finally(() => {
    imports.mainloop.quit();
  });

imports.mainloop.run();
