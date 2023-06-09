import "reflect-metadata";
import "./client/subprocess-api";
export { ClientLocation } from "./server/client-controller";
export type { ClientProxy } from "./server/client-proxy";
export { startServer } from "./server/server";

declare global {
  interface String {
    replaceAll(search: string, replace: string): string;
  }
}
