import type { clientInterface } from "../client/interface";
import type { createDBusProxy } from "../shared/create-proxy";
import type { EventEmitter } from "../shared/event-emitter";
import { IdGenerator } from "../shared/id-generator";
import { printError } from "../shared/print-error";
import type { ClientEvents, InvokeResult } from "./client-controller";

type ClientInterface = ReturnType<typeof clientInterface>;

export type ClientFunctions = Record<string, (...args: any[]) => any>;

export class ClientProxy<C extends ClientFunctions> {
  private id = new IdGenerator();

  constructor(
    private emitter: EventEmitter<ClientEvents>,
    private client: ReturnType<
      ReturnType<typeof createDBusProxy<ClientInterface>>
    >
  ) {}

  async terminate() {
    this.client.TerminateSync();
  }

  async invoke<F extends keyof C>(
    functionName: F,
    ...args: Parameters<C[F]>
  ): Promise<ReturnType<C[F]>> {
    return new Promise(async (resolve, reject) => {
      const actionID = this.id.next();

      const onResult = (result: InvokeResult) => {
        if (result.actionID === actionID) {
          this.emitter.off("invokeResult", onResult);

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

      this.emitter.on("invokeResult", onResult);

      this.client
        .InvokeAsync(actionID, functionName as string, JSON.stringify(args))
        .catch(printError);
    });
  }
}
