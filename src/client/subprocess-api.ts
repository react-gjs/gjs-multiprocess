import type { InvokeResult } from "../server/client-controller";
import type { ServerService } from "../server/service";
import type { InterfaceOf } from "../shared/dbus-decorators/type-utils";
import { EventEmitter } from "../shared/event-emitter";
import { IdGenerator } from "../shared/id-generator";
import { printError } from "../shared/print-error";
import { Serializer } from "../shared/serializer";

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
      ...args: Parameters<MainProcessApi[Name]>
    ) => ReturnType<MainProcessApi[Name]>;
  };

  interface Subprocess {
    invoke: InvokeFunction & InvokeFunctionProxies;
  }

  const Subprocess: null | Subprocess;
}

type ServerInterface = InterfaceOf<ServerService>;

export class SubprocessApi {
  private id = new IdGenerator();
  private _emitter = new EventEmitter<{ invokeResult: [InvokeResult] }>();

  public invoke;

  public constructor(private appID: string, private server: ServerInterface) {
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
          try {
            this._emitter.off("invokeResult", onResult);

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
          } catch (e) {
            reject(e);
          }
        }
      };

      this._emitter.on("invokeResult", onResult);

      try {
        this.server
          .InvokeAsync(
            this.appID,
            actionID,
            functionName as string,
            Serializer.stringify(args)
          )
          .catch((err) => {
            this._emitter.off("invokeResult", onResult);
            printError(err);
            reject(err);
          });
      } catch (e) {
        this._emitter.off("invokeResult", onResult);
        printError(e);
        reject(e);
      }
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
