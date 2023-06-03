import GLib from "gi://GLib?version=2.0";
import Gio from "gi://Gio?version=2.0";
import { clientInterface } from "../client/interface";
import { createDBusProxy } from "../shared/create-proxy";
import { EventEmitter } from "../shared/event-emitter";
import { printError } from "../shared/print-error";
import type { ClientFunctions } from "./client-proxy";
import { ClientProxy } from "./client-proxy";

// @ts-expect-error
const fileUri = import.meta.url;
const __filename = GLib.uri_parse(fileUri, GLib.UriFlags.NONE).get_path()!;
const __dirname = GLib.path_get_dirname(__filename);

export type InvokeResult =
  | {
      actionID: string;
      result: string;
      error?: undefined;
    }
  | {
      actionID: string;
      error: string;
      result?: undefined;
    };

export type ClientEvents = {
  isReady: [];
  moduleLoaded: [];
  invokeResult: [InvokeResult];
};

export class ClientController {
  private isReady = false;
  private emitter = new EventEmitter<ClientEvents>();
  private serverApi: Map<string, (...args: any[]) => any> = new Map();
  private client;
  private proxy;
  clientID;

  constructor(appID: string, uid: string) {
    this.clientID = appID + "client" + uid;

    const ClientDBusProxy = createDBusProxy(clientInterface(this.clientID));

    Gio.Subprocess.new(
      [
        "gjs",
        "-m",
        GLib.path_get_dirname(__dirname) + "/client/client.mjs",
        appID,
        this.clientID,
      ],
      Gio.SubprocessFlags.NONE
    );

    this.client = ClientDBusProxy(
      Gio.DBus.session,
      this.clientID,
      "/" + this.clientID.replaceAll(".", "/")
    );

    this.proxy = new ClientProxy(this.emitter, this.client);
  }

  private actionError(actionID: string, error: any) {
    this.client
      .ActionErrorAsync(
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
    this.client
      .ActionResultAsync(actionID, JSON.stringify(result))
      .catch(printError);
  }

  registerServerApi(api: Record<string, (...args: any[]) => any>) {
    for (const [name, fn] of Object.entries(api)) {
      this.serverApi.set(name, fn);
    }
  }

  invokeServerFunction(actionID: string, name: string, arguments_: string) {
    const fn = this.serverApi.get(name);

    if (!fn || typeof fn !== "function") {
      return this.actionError(
        actionID,
        new Error(`${String(fn)} cannot be called.`)
      );
    }

    (async () => {
      try {
        const args = JSON.parse(arguments_);
        const result = await fn(...args);
        this.actionResult(actionID, result);
      } catch (error) {
        this.actionError(actionID, error);
      }
    })();
  }

  loadImport(importPath: string) {
    return new Promise<void>((resolve) => {
      const onLoad = () => {
        this.emitter.off("moduleLoaded", onLoad);
        resolve();
      };

      this.emitter.on("moduleLoaded", onLoad);

      if (this.isReady) {
        this.client.LoadImportAsync(importPath).catch(printError);
      } else {
        const onReady = () => {
          this.emitter.off("isReady", onReady);
          this.client.LoadImportAsync(importPath).catch(printError);
        };
        this.emitter.on("isReady", onReady);
      }
    });
  }

  notifyIsReady() {
    this.isReady = true;
    this.emitter.emit("isReady");
  }

  notifyModuleLoaded() {
    this.emitter.emit("moduleLoaded");
  }

  notifyActionError(actionID: string, error: string) {
    this.emitter.emit("invokeResult", {
      actionID,
      error,
    });
  }

  notifyActionResult(actionID: string, result: string) {
    this.emitter.emit("invokeResult", {
      actionID,
      result,
    });
  }

  getProxy<C extends ClientFunctions>() {
    return this.proxy as ClientProxy<C>;
  }
}
