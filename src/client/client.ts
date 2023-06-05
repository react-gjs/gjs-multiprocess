import Gio from "gi://Gio?version=2.0";
import System from "system";
import { serverInterface } from "../server/interface";
import type { XmlInterface } from "../shared/create-proxy";
import { createDBusProxy } from "../shared/create-proxy";
import { printError } from "../shared/print-error";
import { serializeError } from "../shared/serialize-error";
import { DBusSession } from "../shared/start-session";
import { clientInterface } from "./interface";
import { SubprocessApi } from "./subprocess-api";

class ClientService implements XmlInterface<typeof clientInterface> {
  subprocessApi;
  module: any;
  server;

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

  private actionError(actionID: string, error: any) {
    this.server
      .ActionErrorAsync(
        this.appID,
        actionID,
        error instanceof Error
          ? JSON.stringify({
              name: error.name,
              message: error.message,
              stack: error.stack,
            })
          : JSON.stringify({
              error: String(error),
            })
      )
      .catch(printError);
  }

  private actionResult(actionID: string, result: any) {
    this.server
      .ActionResultAsync(this.appID, actionID, JSON.stringify(result))
      .catch(printError);
  }

  Terminate() {
    this.session.close();
    imports.mainloop.quit("client");
  }

  LoadImport(importPath: string) {
    Object.assign(globalThis, {
      Subprocess: this.subprocessApi,
    });

    import(importPath)
      .then((module) => {
        this.module = module;
        this.server.ModuleLoadedAsync(this.appID).catch(printError);
      })
      .catch((error) => {
        // try to parse the error
        this.server
          .LoadErrorAsync(this.appID, serializeError(error))
          .catch((err) => {
            this.server
              .LoadErrorAsync(this.appID, serializeError(err))
              .catch(() => {});
          });
      });
  }

  ActionError(actionID: string, error: string) {
    this.subprocessApi._notifyActionError(actionID, error);
  }

  ActionResult(actionID: string, result: string) {
    this.subprocessApi._notifyActionResult(actionID, result);
  }

  Invoke(actionID: string, functionName: string, arguments_: string) {
    if (!this.module) {
      return this.actionError(actionID, new Error("Module not loaded."));
    }

    const fn = this.module[functionName];

    if (!fn || typeof fn !== "function") {
      return this.actionError(
        actionID,
        new Error(`${String(fn)} cannot be called.`)
      );
    }

    (async () => {
      const args = JSON.parse(arguments_);
      const result = await fn(...args);
      this.actionResult(actionID, result);
    })().catch((error) => {
      this.actionError(actionID, error);
    });
  }
}

export const startClient = async (appID: string, parentProcessID: string) => {
  const session = await DBusSession.start(appID);
  const service = new ClientService(session, appID, parentProcessID);

  session.exportService(
    Gio.DBusExportedObject.wrapJSObject(clientInterface(appID), service),
    "/" + appID.replaceAll(".", "/")
  );

  service.server.SubprocessReadyAsync(appID).catch(printError);
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

  imports.mainloop.run("client");

  System.exit(0);
};

main();
