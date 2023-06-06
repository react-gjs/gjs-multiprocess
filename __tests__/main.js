import { startServer } from "../dist/esm/index.mjs";
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
      serverApi
    );

    /** @type {ClientProxy} */
    const client2 = await server.createClient(
      "file:///home/owner/Documents/gjs-multiprocess/__tests__/worker.js",
      serverApi
    );

    /** @type {ClientProxy} */
    const client3 = await server.createClient(
      "file:///home/owner/Documents/gjs-multiprocess/__tests__/worker.js",
      serverApi
    );

    /** @type {ClientProxy} */
    const client4 = await server.createClient(
      "file:///home/owner/Documents/gjs-multiprocess/__tests__/worker.js",
      serverApi
    );

    const longs = await Promise.all([
      client1.invoke("bumpInternalCounter"),
      client1.invoke.bumpInternalCounter(),
      client1.invoke.bumpInternalCounter(),
      client2.invoke.bumpInternalCounter(),
      client2.invoke.bumpInternalCounter(),
      client3.invoke.bumpInternalCounter(),
      client4.invoke.bumpInternalCounter(),
    ]);

    const counters = await Promise.all([
      client1.get("internalCounter"),
      client2.get.internalCounter,
      client3.get("internalCounter"),
      client4.get.internalCounter,
    ]);

    console.log(counters);
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
