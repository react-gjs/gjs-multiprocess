import GLib from "gi://GLib?version=2.0";
import Gio from "gi://Gio?version=2.0";
import { clientInterface } from "../client/interface";
import { attempt } from "../shared/attempt";
import { createDBusProxy } from "../shared/create-proxy";
import { EventEmitter } from "../shared/event-emitter";
import { printError } from "../shared/print-error";
import { Serializer } from "../shared/serializer";
import type { ClientModule } from "./client-proxy";
import { ClientProxy } from "./client-proxy";

// @ts-expect-error
const fileUri = import.meta.url;
const __filename = GLib.uri_parse(fileUri, GLib.UriFlags.NONE).get_path()!;
const __dirname = GLib.path_get_dirname(__filename);

const parentLocation = fileUri.startsWith("resource://")
  ? "resource://" + GLib.path_get_dirname(__dirname)
  : GLib.path_get_dirname(__dirname);

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

export type GetResult = {
  actionID: string;
  result: string;
};

export type ClientEvents = {
  isReady: [];
  moduleLoaded: [];
  loadError: [Error];
  invokeResult: [InvokeResult];
  getResult: [GetResult];
};

export class ClientController {
  private isReady = false;
  private emitter = new EventEmitter<ClientEvents>();
  private serverApi: Map<string, (...args: any[]) => any> = new Map();
  private client;
  private proxy;
  public clientID;

  public constructor(appID: string, uid: string) {
    this.clientID = appID + ".client" + uid;

    const ClientDBusProxy = createDBusProxy(clientInterface(this.clientID));

    Gio.Subprocess.new(
      [
        "gjs",
        "-m",
        parentLocation + "/client/client.mjs",
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

  private actionResult(actionID: string, result: any) {
    this.client
      .ActionResultAsync(actionID, Serializer.stringify(result))
      .catch(printError);
  }

  public registerServerApi(api: Record<string, (...args: any[]) => any>) {
    for (const [name, fn] of Object.entries(api)) {
      this.serverApi.set(name, fn);
    }
  }

  public invokeServerFunction(
    actionID: string,
    name: string,
    arguments_: string
  ) {
    const fn = this.serverApi.get(name);

    if (!fn || typeof fn !== "function") {
      return this.actionError(
        actionID,
        new Error(`${String(fn)} cannot be called.`)
      );
    }

    (async () => {
      const args = Serializer.parse<any[]>(arguments_);
      const result = await fn(...args);
      this.actionResult(actionID, result);
    })().catch((error) => {
      this.actionError(actionID, error);
    });
  }

  public loadImport(importPath: string) {
    return new Promise<void>((resolve, reject) => {
      const onLoad = () => {
        this.emitter.off("moduleLoaded", onLoad);
        resolve();
      };

      const onError = (e: Error) => {
        this.emitter.off("loadError", onError);
        reject(e);
      };

      this.emitter.on("moduleLoaded", onLoad);
      this.emitter.on("loadError", onError);

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

  public notifyIsReady() {
    this.isReady = true;
    this.emitter.emit("isReady");
  }

  public notifyModuleLoaded() {
    this.emitter.emit("moduleLoaded");
  }

  public notifyLoadError(e: string) {
    const serializedError = attempt(() => Serializer.parse(e));
    const isObject =
      typeof serializedError === "object" && serializedError !== null;
    const message =
      isObject && "message" in serializedError
        ? (serializedError.message as string)
        : String(serializedError);
    const stack =
      isObject && "stack" in serializedError
        ? (serializedError.stack as string)
        : undefined;

    const error = new Error(message);
    error.stack = stack;

    this.emitter.emit("loadError", error);
  }

  public notifyActionError(actionID: string, error: string) {
    this.emitter.emit("invokeResult", {
      actionID,
      error,
    });
  }

  public notifyActionResult(actionID: string, result: string) {
    this.emitter.emit("invokeResult", {
      actionID,
      result,
    });
  }

  public notifyGetResult(actionID: string, result: string) {
    this.emitter.emit("getResult", {
      actionID,
      result,
    });
  }

  public getProxy<C extends ClientModule>() {
    return this.proxy as ClientProxy<C>;
  }
}
