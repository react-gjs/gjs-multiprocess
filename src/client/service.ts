import Gio from "gi://Gio?version=2.0";
import { ServerService } from "../server/service";
import { createDBusProxy } from "../shared/create-proxy";
import { Export } from "../shared/dbus-decorators/dbus-interface";
import type { DBusSession } from "../shared/dbus-session";
import { Mainloop } from "../shared/mainloop";
import { printError } from "../shared/print-error";
import { serializeError } from "../shared/serialize-error";
import { Serializer } from "../shared/serializer";
import { SubprocessApi } from "./subprocess-api";

export class ClientService {
  public subprocessApi;
  public module: any;
  public server;

  constructor(
    private session: DBusSession,
    private appID: string,
    parentProcessID: string
  ) {
    const ServerProxy = createDBusProxy(parentProcessID, ServerService);

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

  @Export
  public Terminate() {
    Mainloop.quit();
    this.session.close();
  }

  @Export
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

  @Export
  public ActionError(actionID: string, error: string) {
    this.subprocessApi._notifyActionError(actionID, error);
  }

  @Export
  public ActionResult(actionID: string, result: string) {
    this.subprocessApi._notifyActionResult(actionID, result);
  }

  @Export
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

  @Export
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
