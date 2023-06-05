import GLib from "gi://GLib?version=2.0";
import Gio from "gi://Gio?version=2.0";
import type { XmlInterface } from "../shared/create-proxy";
import { IdGenerator } from "../shared/id-generator";
import path from "../shared/path";
import { DBusSession } from "../shared/start-session";
import { ClientController } from "./client-controller";
import type { ClientFunctions } from "./client-proxy";
import { serverInterface } from "./interface";

Object.defineProperty(globalThis, "Subprocess", {
  get() {
    throw new Error("Subprocess is not available from the main process.");
  },
});

class Service implements XmlInterface<typeof serverInterface> {
  private clients: Map<string, ClientController> = new Map();

  constructor(private session: DBusSession, private appID: string) {}

  addClient(uid: string) {
    const clientController = new ClientController(this.appID, uid);
    this.clients.set(clientController.clientID, clientController);

    return clientController;
  }

  terminateAll() {
    for (const client of this.clients.values()) {
      client.getProxy().terminate();
    }
  }

  SubprocessReady(clientName: string) {
    const client = this.clients.get(clientName);
    client?.notifyIsReady();
  }

  ModuleLoaded(clientName: string) {
    const client = this.clients.get(clientName);
    client?.notifyModuleLoaded();
  }

  LoadError(clientName: string, error: string) {
    const client = this.clients.get(clientName);
    client?.notifyLoadError(error);
  }

  ActionError(clientID: string, actionID: string, error: string) {
    const client = this.clients.get(clientID);
    client?.notifyActionError(actionID, error);
  }

  ActionResult(clientID: string, actionID: string, result: string) {
    const client = this.clients.get(clientID);
    client?.notifyActionResult(actionID, result);
  }

  Invoke(
    clientID: string,
    actionID: string,
    functionName: string,
    arguments_: string
  ) {
    const client = this.clients.get(clientID);
    client?.invokeServerFunction(actionID, functionName, arguments_);
  }
}

export const startServer = async (appID: string) => {
  const session = await DBusSession.start(appID);
  const service = new Service(session, appID);

  session.exportService(
    Gio.DBusExportedObject.wrapJSObject(serverInterface(appID), service),
    "/" + appID.replaceAll(".", "/")
  );

  const id = new IdGenerator();

  const createClient = async <C extends ClientFunctions>(
    entrypoint: string,
    mainProcessApi?: Record<string, (...args: any[]) => any>
  ) => {
    if (
      !entrypoint.startsWith("file://") &&
      !entrypoint.startsWith("resource://")
    ) {
      entrypoint = "file://" + path.join(GLib.get_current_dir(), entrypoint);
    }

    const uid = id.next();

    const client = service.addClient(uid);
    if (mainProcessApi) client.registerServerApi(mainProcessApi);
    await client.loadImport(entrypoint);

    return client.getProxy<C>();
  };

  const close = () => {
    service.terminateAll();
    session.close();
  };

  return {
    createClient,
    close,
  };
};
