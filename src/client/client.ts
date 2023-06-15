import Gio from "gi://Gio?version=2.0";
import System from "system";
import { serverInterface } from "../server/interface";
import type { XmlInterface } from "../shared/create-proxy";
import { createDBusProxy } from "../shared/create-proxy";
import { DBusSession } from "../shared/dbus-session";
import { Mainloop } from "../shared/mainloop";
import { printError } from "../shared/print-error";
import { serializeError } from "../shared/serialize-error";
import { Serializer } from "../shared/serializer";
import { clientInterface } from "./interface";
import { SubprocessApi } from "./subprocess-api";

class ClientService implements XmlInterface<typeof clientInterface> {
  public subprocessApi;
  public module: any;
  public server;

  constructor(
    private session: DBusSession,
    private appID: string,
    parentProcessID: string
  ) {
    const ServerProxy = createDBusProxy(serverInterface(parentProcessID));

    this.server = ServerProxy(
      Gio.DBus.session,
      parentProcessID,
      "/" + parentProcessID.replaceAll(".", "/")
    );

    this.subprocessApi = new SubprocessApi(appID, this.server);
  }

  private sendActionError(actionID: string, error: any) {
    this.server
      .ActionErrorAsync(
        this.appID,
        actionID,
        error instanceof Error
          ? Serializer.stringify({
              name: error.name,
              message: error.message,
              stack: error.stack,
            })
          : Serializer.stringify({
              error: String(error),
            })
      )
      .catch(printError);
  }

  private sendActionResult(actionID: string, result: any) {
    this.server
      .ActionResultAsync(this.appID, actionID, Serializer.stringify(result))
      .catch(printError);
  }

  private sendGetResult(actionID: string, result: any) {
    this.server
      .GetResultAsync(this.appID, actionID, Serializer.stringify(result))
      .catch(printError);
  }

  public Terminate() {
    Mainloop.quit();
    this.session.close();
  }

  public LoadImport(importPath: string) {
    Object.assign(globalThis, {
      Subprocess: this.subprocessApi,
    });

    (async () => {
      try {
        const module = await import(importPath);
        this.module = module;
        this.server.ModuleLoadedAsync(this.appID).catch(printError);
      } catch (error) {
        this.server
          .LoadErrorAsync(this.appID, serializeError(error))
          .catch((err) =>
            this.server
              .LoadErrorAsync(this.appID, serializeError(err))
              .catch(() => {})
              .finally(() => {
                Mainloop.quit(1);
                this.session.close();
              })
          );
      }
    })().catch(() => {});
  }

  public ActionError(actionID: string, error: string) {
    this.subprocessApi._notifyActionError(actionID, error);
  }

  public ActionResult(actionID: string, result: string) {
    this.subprocessApi._notifyActionResult(actionID, result);
  }

  public Invoke(actionID: string, exportName: string, arguments_: string) {
    if (!this.module) {
      return this.sendActionError(actionID, new Error("Module not loaded."));
    }

    const fn = this.module[exportName];

    if (!fn || typeof fn !== "function") {
      return this.sendActionError(
        actionID,
        new Error(`${String(fn)} cannot be called.`)
      );
    }

    (async () => {
      const args = Serializer.parse<any[]>(arguments_);
      const result = await fn(...args);
      this.sendActionResult(actionID, result);
    })().catch((error) => {
      this.sendActionError(actionID, error);
    });
  }

  public Get(actionID: string, exportName: string) {
    if (!this.module) {
      printError(new Error("Module not loaded."));
      return this.sendGetResult(actionID, null);
    }

    try {
      const value = this.module[exportName];

      if (typeof value === "function") {
        throw new Error(
          "Functions of subprocesses cannot be directly accessed. Use 'invoke()' instead."
        );
      }

      this.sendGetResult(actionID, value ?? null);
    } catch (error) {
      printError(error);
      this.sendGetResult(actionID, null);
    }
  }
}

export const startClient = async (appID: string, parentProcessID: string) => {
  try {
    const session = await DBusSession.start(appID);
    const service = new ClientService(session, appID, parentProcessID);

    session.exportService(
      Gio.DBusExportedObject.wrapJSObject(clientInterface(appID), service),
      "/" + appID.replaceAll(".", "/")
    );

    await service.server.SubprocessReadyAsync(appID);
  } catch (error) {
    printError(error);
    Mainloop.quit(1);
  }
};

const main = () => {
  const parentProcessID = ARGV[0];
  const clientName = ARGV[1];

  if (!clientName) {
    console.error("Client Name not specified.");
    System.exit(1);
    return;
  }

  if (!parentProcessID) {
    console.error("Parent Process ID not specified.");
    System.exit(1);
    return;
  }

  setTimeout(() => {
    startClient(clientName, parentProcessID).catch(printError);
  });

  const exitCode = Mainloop.start("client");

  System.exit(exitCode);
};

main();
