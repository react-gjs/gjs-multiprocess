import type Gio from "gi://Gio?version=2.0";
import type { ClientService } from "../client/service";
import type { InterfaceOf } from "../shared/dbus-decorators/type-utils";
import type { EventEmitter } from "../shared/event-emitter";
import { IdGenerator } from "../shared/id-generator";
import { printError } from "../shared/print-error";
import { Serializer } from "../shared/serializer";
import type { ClientEvents, GetResult, InvokeResult } from "./client-controller";

type ClientInterface = InterfaceOf<ClientService>;

type ValuesOf<T> = T[keyof T];

type KeyOfMethods<T> = ValuesOf<
  {
    [K in keyof T as T[K] extends Function ? K : never]: K;
  }
>;

type KeyOfProperties<T> = ValuesOf<
  {
    [K in keyof T as T[K] extends Function ? never : K]: K;
  }
>;

type Promisify<F> = F extends (...args: infer A) => infer R ? (...args: A) => Promise<R>
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
  private hasExited = false;
  private exitCode: number | null = null;

  public invoke: Invoke<C>;
  public get: Get<C>;

  public constructor(
    private emitter: EventEmitter<ClientEvents>,
    private client: ClientInterface,
    private subprocess: Gio.Subprocess,
  ) {
    subprocess.wait_async(null, (_, res) => {
      subprocess.wait_check_finish(res);
      this.hasExited = true;
      this.exitCode = subprocess.get_exit_status();
      this.emitter.emit("processExited", this.exitCode);
    });

    const cproxy = this;

    function invoke(functionName: string, ...args: Parameters<C[keyof C]>) {
      return cproxy._invoke(functionName, ...args);
    }

    this.invoke = new Proxy(invoke, {
      get(_, exportName: any) {
        return (...args: Parameters<C[keyof C]>) => invoke(exportName, ...args);
      },
    }) as any;

    function get(exportName: string) {
      return cproxy._get(exportName);
    }

    this.get = new Proxy(get, {
      get(_, exportName: any) {
        return get(exportName);
      },
    }) as any;

    const onLoadError = () => {
      this.state = "closed";
      this.emitter.off("loadError", onLoadError);
    };

    this.emitter.on("loadError", onLoadError);
  }

  private ensureOpen() {
    if (this.state === "closed") {
      throw new Error("Client has been terminated.");
    }
  }

  public async terminate() {
    if (this.state !== "closed") {
      this.state = "closed";
      await this.client.TerminateAsync();
    }

    return new Promise<void>((resolve) => {
      if (this.hasExited) {
        resolve();
        return;
      }

      const start = Date.now();

      setInterval(() => {
        if (this.hasExited) {
          resolve();
        }

        if (Date.now() - start > 500) {
          try {
            this.subprocess.force_exit();
          } catch (err) {
            //
          }
          resolve();
        }
      }, 50);
    });
  }

  /**
   * Add a callback that will be called once the subprocess exits.
   */
  public async onExit(
    cb: (
      exitcode: number,
      stdout: Gio.InputStream | null,
      stderr: Gio.InputStream | null,
    ) => void,
  ) {
    if (this.hasExited) {
      const stdoutStream = this.subprocess.get_stdout_pipe();
      const stderrStream = this.subprocess.get_stderr_pipe();
      cb(this.exitCode!, stdoutStream, stderrStream);
      return;
    }

    this.emitter.on("processExited", (ecode) => {
      const stdoutStream = this.subprocess.get_stdout_pipe();
      const stderrStream = this.subprocess.get_stderr_pipe();
      cb(ecode, stdoutStream, stderrStream);
    });
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
                e?.message ?? e?.error ?? "Unknown error",
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
            Serializer.stringify(args),
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
