import type { InvokeResult } from "../server/client-controller";
import type { serverInterface } from "../server/interface";
import type { createDBusProxy } from "../shared/create-proxy";
import { EventEmitter } from "../shared/event-emitter";
import { IdGenerator } from "../shared/id-generator";
import { printError } from "../shared/print-error";

declare global {
  interface ParentProcessApi {}

  interface InvokeFunction {
    <Name extends keyof ParentProcessApi>(
      functionName: Name,
      args: Parameters<ParentProcessApi[Name]>
    ): ReturnType<ParentProcessApi[Name]>;
  }

  type InvokeFunctionProxies = {
    [Name in keyof ParentProcessApi]: (
      functionName: Name,
      args: Parameters<ParentProcessApi[Name]>
    ) => ReturnType<ParentProcessApi[Name]>;
  };

  interface Subprocess {
    invoke: InvokeFunction & InvokeFunctionProxies;
  }

  const Subprocess: undefined;
}

type ServerInterface = ReturnType<typeof serverInterface>;

export class SubprocessApi {
  static create(
    appID: string,
    server: ReturnType<ReturnType<typeof createDBusProxy<ServerInterface>>>
  ) {
    const instance = new SubprocessApi(appID, server);

    function invoke(functionName: string, ...args: any[]) {
      return instance._invoke(functionName, ...args);
    }

    return new Proxy(invoke, {
      get(_, functionName: keyof SubprocessApi) {
        return instance[functionName].bind(instance);
      },
    });
  }

  private id = new IdGenerator();
  private _emitter = new EventEmitter<{ invokeResult: [InvokeResult] }>();

  public invoke;

  constructor(
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
        .catch(printError);
    });
  }

  _notifyActionError(actionID: string, error: string) {
    this._emitter.emit("invokeResult", {
      actionID,
      error,
    });
  }

  _notifyActionResult(actionID: string, result: string) {
    this._emitter.emit("invokeResult", {
      actionID,
      result,
    });
  }
}
