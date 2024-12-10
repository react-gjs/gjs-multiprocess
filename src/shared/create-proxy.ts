import Gio from "gi://Gio?version=2.0";
import { compileInterface } from "./dbus-decorators/dbus-interface";
import type { InterfaceOf } from "./dbus-decorators/type-utils";

export const createDBusProxy = <T extends object>(
  name: string,
  interfaceService: new(...args: any[]) => T,
) => {
  const interfaceSignature = compileInterface(name, interfaceService);
  return Gio.DBusProxy.makeProxyWrapper<InterfaceOf<T>>(interfaceSignature);
};
