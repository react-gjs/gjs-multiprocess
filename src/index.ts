export { startServer } from "./server/server";

declare global {
  interface String {
    replaceAll(search: string, replace: string): string;
  }
}
