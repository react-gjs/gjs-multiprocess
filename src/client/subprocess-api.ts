import type { InvokeResult } from "../server/client-controller";
import type { serverInterface } from "../server/interface";
import type { createDBusProxy } from "../shared/create-proxy";
import { EventEmitter } from "../shared/event-emitter";
import { IdGenerator } from "../shared/id-generator";
import { printError } from "../shared/print-error";

declare global {
  interface MainProcessApi {}

  interface InvokeFunction {
    <Name extends keyof MainProcessApi>(
      functionName: Name,
      args: Parameters<MainProcessApi[Name]>
    ): ReturnType<MainProcessApi[Name]>;
  }

  type InvokeFunctionProxies = {
    [Name in keyof MainProcessApi]: (
      functionName: Name,
      args: Parameters<MainProcessApi[Name]>
    ) => ReturnType<MainProcessApi[Name]>;
  };

  interface Subprocess {
    invoke: InvokeFunction & InvokeFunctionProxies;
  }

  const Subprocess: null | Subprocess;
}

type ServerInterface = ReturnType<typeof serverInterface>;

export class SubprocessApi {
  private id = new IdGenerator();
  private _emitter = new EventEmitter<{ invokeResult: [InvokeResult] }>();

  public invoke;

  public constructor(
    private appID: string,
    private server: ReturnType<
      ReturnType<typeof createDBusProxy<ServerInterface>>
    >
  ) {
    const subprocess = this;

    function invoke(functionName: string, ...args: any[]) {
      return subprocess._invoke(functionName, ...args);
    }

    this.invoke = new Proxy(invoke, {
      get(_, functionName: keyof SubprocessApi) {
        return (...args: any[]) => invoke(functionName as string, ...args);
      },
    });
  }

  private _invoke(functionName: string, ...args: any[]) {
    return new Promise(async (resolve, reject) => {
      const actionID = this.id.next();

      const onResult = (result: InvokeResult) => {
        if (result.actionID === actionID) {
          this._emitter.off("invokeResult", onResult);

          if (result.result) {
            resolve(JSON.parse(result.result));
          } else {
            const e = JSON.parse(result.error!);
            const error = new Error(e.message ?? e.error ?? "Unknown error");
            if (e.name) {
              error.name = e.name;
            }
            if (e.stack) {
              error.stack = e.stack;
            }
            reject(error);
          }
        }
      };

      this._emitter.on("invokeResult", onResult);

      this.server
        .InvokeAsync(
          this.appID,
          actionID,
          functionName as string,
          JSON.stringify(args)
        )
        .catch((err) => {
          this._emitter.off("invokeResult", onResult);
          printError(err);
          reject(err);
        });
    });
  }

  public _notifyActionError(actionID: string, error: string) {
    this._emitter.emit("invokeResult", {
      actionID,
      error,
    });
  }

  public _notifyActionResult(actionID: string, result: string) {
    this._emitter.emit("invokeResult", {
      actionID,
      result,
    });
  }
}
