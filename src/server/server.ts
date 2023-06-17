import type Gio from "gi://Gio?version=2.0";
import { DBusSession } from "../shared/dbus-session";
import { IdGenerator } from "../shared/id-generator";
import path from "../shared/path";
import type { ClientModule } from "./client-proxy";
import { ServerService } from "./service";

Object.defineProperty(globalThis, "Subprocess", {
  value: null,
  configurable: false,
  writable: false,
});

export type DBusConnection = {
  connection: Gio.DBusConnection;
  name: string;
};

/**
 * @param appID Can be either a DBus name, in which case a new
 *   DBus connection will be created, or and object containing a
 *   DBus connection and a name that was used to create it.
 */
export const startServer = async (appID: string | DBusConnection) => {
  const session = await DBusSession.start(appID);
  const service = new ServerService(session.getName());

  session.exportService(service);

  const id = new IdGenerator();

  const createClient = async <C extends ClientModule>(
    entrypoint: string,
    mainProcessApi?: object
  ) => {
    if (
      !entrypoint.startsWith("file://") &&
      !entrypoint.startsWith("resource://")
    ) {
      entrypoint = "file://" + path.resolve(entrypoint);
    }

    const uid = id.next();

    const client = service.addClient(uid);
    if (mainProcessApi) client.registerServerApi(mainProcessApi as any);
    await client.loadImport(entrypoint);

    return client.getProxy<C>();
  };

  const close = async () => {
    await service.terminateAll();
    session.close();
  };

  return {
    /**
     * Spawns a new client process (aka worker).
     *
     * Optionally a dictionary of methods can be provided, client
     * will be able to call the via the `Subprocess` global
     * object.
     *
     * When using TypeScript, method definitions can be added to
     * the `Subprocess` object by extending the `MainProcessApi`
     * interface:
     *
     * @example
     *   declare global {
     *     interface MainProcessApi {
     *       myMethodProvidedByMainProcess: (
     *         arg1: string
     *       ) => void;
     *     }
     *   }
     *
     *   Subprocess.invoke.myMethodProvidedByMainProcess(
     *     "foo"
     *   );
     */
    createClient,
    close,
  };
};
