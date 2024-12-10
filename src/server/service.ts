import { Export } from "../shared/dbus-decorators/dbus-interface";
import { ClientController } from "./client-controller";

export class ServerService {
  private clients: Map<string, ClientController> = new Map();

  public constructor(private appID: string) {}

  public addClient(uid: string) {
    const clientController = new ClientController(this.appID, uid);
    this.clients.set(clientController.clientID, clientController);

    return clientController;
  }

  public async terminateAll() {
    await Promise.all(
      Array.from(this.clients.values()).map((c) => c.getProxy().terminate()),
    );
  }

  @Export
  public SubprocessReady(clientName: string) {
    const client = this.clients.get(clientName);
    client?.notifyIsReady();
  }

  @Export
  public ModuleLoaded(clientName: string) {
    const client = this.clients.get(clientName);
    client?.notifyModuleLoaded();
  }

  @Export
  public LoadError(clientName: string, error: string) {
    const client = this.clients.get(clientName);
    client?.notifyLoadError(error);
  }

  @Export
  public ActionError(clientID: string, actionID: string, error: string) {
    const client = this.clients.get(clientID);
    client?.notifyActionError(actionID, error);
  }

  @Export
  public ActionResult(clientID: string, actionID: string, result: string) {
    const client = this.clients.get(clientID);
    client?.notifyActionResult(actionID, result);
  }

  @Export
  public GetResult(clientID: string, actionID: string, result: string) {
    const client = this.clients.get(clientID);
    client?.notifyGetResult(actionID, result);
  }

  @Export
  public Invoke(
    clientID: string,
    actionID: string,
    functionName: string,
    arguments_: string,
  ) {
    const client = this.clients.get(clientID);
    client?.invokeServerFunction(actionID, functionName, arguments_);
  }
}
