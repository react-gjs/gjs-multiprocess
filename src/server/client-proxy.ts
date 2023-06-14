import type { clientInterface } from "../client/interface";
import type { createDBusProxy } from "../shared/create-proxy";
import type { EventEmitter } from "../shared/event-emitter";
import { IdGenerator } from "../shared/id-generator";
import { printError } from "../shared/print-error";
import { Serializer } from "../shared/serializer";
import type {
  ClientEvents,
  GetResult,
  InvokeResult,
} from "./client-controller";

type ClientInterface = ReturnType<typeof clientInterface>;

type ValuesOf<T> = T[keyof T];

type KeyOfMethods<T> = ValuesOf<{
  [K in keyof T as T[K] extends Function ? K : never]: K;
}>;

type KeyOfProperties<T> = ValuesOf<{
  [K in keyof T as T[K] extends Function ? never : K]: K;
}>;

type Promisify<F> = F extends (...args: infer A) => infer R
  ? (...args: A) => Promise<R>
  : never;

type InvokeProxy<C extends ClientModule> = {
  [K in keyof C as C[K] extends Function ? K : never]: Promisify<C[K]>;
};

type Invoke<C extends ClientModule> = InvokeProxy<C> & {
  <F extends KeyOfMethods<C>>(
    functionName: F,
    ...args: Parameters<C[F]>
  ): Promise<ReturnType<C[F]>>;
};

type GetProxy<C extends ClientModule> = {
  [K in keyof C as C[K] extends Function ? never : K]: Promise<C[K]>;
};

type Get<C extends ClientModule> = GetProxy<C> & {
  <K extends KeyOfProperties<C>>(functionName: K): Promise<C[K]>;
};

export type ClientModule = Record<string, any>;

export class ClientProxy<C extends ClientModule> {
  private id = new IdGenerator();
  private state: "open" | "closed" = "open";

  public invoke: Invoke<C>;
  public get: Get<C>;

  public constructor(
    private emitter: EventEmitter<ClientEvents>,
    private client: ReturnType<
      ReturnType<typeof createDBusProxy<ClientInterface>>
    >
  ) {
    const subprocess = this;

    function invoke(functionName: string, ...args: Parameters<C[keyof C]>) {
      return subprocess._invoke(functionName, ...args);
    }

    this.invoke = new Proxy(invoke, {
      get(_, exportName: any) {
        return (...args: Parameters<C[keyof C]>) => invoke(exportName, ...args);
      },
    }) as any;

    function get(exportName: string) {
      return subprocess._get(exportName);
    }

    this.get = new Proxy(get, {
      get(_, exportName: any) {
        return get(exportName);
      },
    }) as any;
  }

  private ensureOpen() {
    if (this.state === "closed") {
      throw new Error("Client has been terminated.");
    }
  }

  public terminate() {
    if (this.state === "closed") {
      return;
    }

    this.state = "closed";
    return this.client.TerminateSync();
  }

  private async _invoke<F extends keyof C>(
    exportName: F,
    ...args: Parameters<C[F]>
  ): Promise<ReturnType<C[F]>> {
    await this.ensureOpen();

    return await new Promise(async (resolve, reject) => {
      const actionID = this.id.next();

      const onResult = (result: InvokeResult) => {
        if (result.actionID === actionID) {
          try {
            this.emitter.off("invokeResult", onResult);

            if (result.result) {
              resolve(Serializer.parse(result.result));
            } else {
              const e = Serializer.parse<any>(result.error!);
              const error = new Error(
                e?.message ?? e?.error ?? "Unknown error"
              );
              if (e.name) {
                error.name = e.name;
              }
              if (e.stack) {
                error.stack = e.stack;
              }
              reject(error);
            }
          } catch (err) {
            reject(err);
          }
        }
      };

      this.emitter.on("invokeResult", onResult);

      try {
        this.client
          .InvokeAsync(
            actionID,
            exportName as string,
            Serializer.stringify(args)
          )
          .catch((err) => {
            this.emitter.off("invokeResult", onResult);
            printError(err);
            reject(err);
          });
      } catch (err) {
        this.emitter.off("invokeResult", onResult);
        printError(err);
        reject(err);
      }
    });
  }

  private async _get<F extends keyof C>(exportName: F): Promise<C[F]> {
    await this.ensureOpen();

    return await new Promise(async (resolve, reject) => {
      const actionID = this.id.next();

      const onResult = (result: GetResult) => {
        if (result.actionID === actionID) {
          try {
            this.emitter.off("getResult", onResult);

            if (result.result) {
              resolve(Serializer.parse(result.result));
            } else {
              reject(new Error(`Unable to access '${exportName as string}'`));
            }
          } catch (err) {
            reject(err);
          }
        }
      };

      this.emitter.on("getResult", onResult);

      this.client.GetAsync(actionID, exportName as string).catch((err) => {
        this.emitter.off("getResult", onResult);
        printError(err);
        reject(err);
      });
    });
  }
}
