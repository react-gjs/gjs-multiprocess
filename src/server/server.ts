import Gio from "gi://Gio?version=2.0";
import type { XmlInterface } from "../shared/create-proxy";
import { DBusSession } from "../shared/dbus-session";
import { IdGenerator } from "../shared/id-generator";
import path from "../shared/path";
import { RefKeeper } from "../shared/ref-keeper";
import { ClientController } from "./client-controller";
import type { ClientModule } from "./client-proxy";
import { serverInterface } from "./interface";

Object.defineProperty(globalThis, "Subprocess", {
  value: null,
});

class Service implements XmlInterface<typeof serverInterface> {
  private clients: Map<string, ClientController> = new Map();

  public constructor(private appID: string) {}

  public addClient(uid: string) {
    const clientController = new ClientController(this.appID, uid);
    this.clients.set(clientController.clientID, clientController);

    return clientController;
  }

  public async terminateAll() {
    await Promise.all(
      Array.from(this.clients.values()).map((c) => c.getProxy().terminate())
    );
  }

  public SubprocessReady(clientName: string) {
    const client = this.clients.get(clientName);
    client?.notifyIsReady();
  }

  public ModuleLoaded(clientName: string) {
    const client = this.clients.get(clientName);
    client?.notifyModuleLoaded();
  }

  public LoadError(clientName: string, error: string) {
    const client = this.clients.get(clientName);
    client?.notifyLoadError(error);
  }

  public ActionError(clientID: string, actionID: string, error: string) {
    const client = this.clients.get(clientID);
    client?.notifyActionError(actionID, error);
  }

  public ActionResult(clientID: string, actionID: string, result: string) {
    const client = this.clients.get(clientID);
    client?.notifyActionResult(actionID, result);
  }

  public GetResult(clientID: string, actionID: string, result: string) {
    const client = this.clients.get(clientID);
    client?.notifyGetResult(actionID, result);
  }

  public Invoke(
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
  const service = new Service(appID);
  const dbusObject = Gio.DBusExportedObject.wrapJSObject(
    serverInterface(appID),
    service
  );

  RefKeeper.ref(dbusObject);
  RefKeeper.ref(service);

  session.exportService(dbusObject, "/" + appID.replaceAll(".", "/"));

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
    createClient,
    close,
  };
};
