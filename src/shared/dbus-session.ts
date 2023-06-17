import Gio from "gi://Gio?version=2.0";
import type { DBusConnection } from "../server/server";
import { compileInterface } from "./dbus-decorators/dbus-interface";
import { getConstructor } from "./get-constructor";
import { References } from "./ref-keeper";

export class DBusSession {
  static async start(
    appID: string | DBusConnection,
    name_acquired_closure: (() => void) | null = null,
    name_lost_closure: (() => void) | null = null
  ) {
    if (typeof appID === "string") {
      const session = new DBusSession();
      await session._init(appID, name_acquired_closure, name_lost_closure);
      return session;
    } else {
      const session = new DBusSession();
      session.name = appID.name;
      session.connection = appID.connection;
      return session;
    }
  }

  private name!: string;
  private sessionID?: number;
  private connection!: Gio.DBusConnection;
  private cleanup = () => {};

  private constructor() {}

  private async _init(
    appID: string,
    name_acquired_closure: (() => void) | null = null,
    name_lost_closure: (() => void) | null = null
  ) {
    this.name = appID;

    await new Promise<void>((resolve) => {
      this.sessionID = Gio.bus_own_name(
        Gio.BusType.SESSION,
        appID,
        Gio.BusNameOwnerFlags.NONE,
        (connection: Gio.DBusConnection) => {
          this.connection = connection;
          resolve();
        },
        name_acquired_closure,
        name_lost_closure
      );
    });
  }

  public getName() {
    return this.name;
  }

  public exportService(service: object) {
    const serviceConstructor = getConstructor(service);
    const interfaceSignature = compileInterface(this.name, serviceConstructor);

    const dbusExportedObject = Gio.DBusExportedObject.wrapJSObject(
      interfaceSignature,
      service
    );

    References.ref(dbusExportedObject);
    References.ref(service);

    dbusExportedObject.export(
      this.connection,
      "/" + this.name.replaceAll(".", "/")
    );

    this.cleanup = () => {
      References.unref(dbusExportedObject);
      References.unref(service);
    };
  }

  public close() {
    if (this.sessionID != null) Gio.bus_unown_name(this.sessionID);
    this.cleanup();
  }
}
