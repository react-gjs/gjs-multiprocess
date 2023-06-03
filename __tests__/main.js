import { startServer } from "../dist/esm/index.mjs";

/**
 * @typedef WorkerApi
 * @property {(fname: string, ...args: any[]) => Promise<any>} invoke
 */

async function main() {
  const server = await startServer("org.gest.test");

  try {
    const serverApi = {
      loopback: (str) => str + str,
    };

    /** @type {WorkerApi} */
    const client1 = await server.createClient(
      "file:///home/owner/Documents/gjs-multiprocess/__tests__/worker.js",
      serverApi
    );

    // /** @type {WorkerApi} */
    // const client2 = await server.createClient(
    //   "file:///home/owner/Documents/gjs-multiprocess/__tests__/worker.js",
    //   serverApi
    // );

    // /** @type {WorkerApi} */
    // const client3 = await server.createClient(
    //   "file:///home/owner/Documents/gjs-multiprocess/__tests__/worker.js",
    //   serverApi
    // );

    // /** @type {WorkerApi} */
    // const client4 = await server.createClient(
    //   "file:///home/owner/Documents/gjs-multiprocess/__tests__/worker.js",
    //   serverApi
    // );

    const longs = await Promise.all([
      client1.invoke("quuz", "boobs"),
      // client2.invoke("foo"),
      // client3.invoke("quuz"),
      // client4.invoke("quux"),
    ]);

    console.log(longs);
  } finally {
    server.close();
  }
}

main()
  .catch(console.error)
  .finally(() => {
    imports.mainloop.quit();
  });

imports.mainloop.run();
