import Gio from "gi://Gio?version=2.0";

export class DBusSession {
  static async start(
    appID: string,
    name_acquired_closure: (() => void) | null = null,
    name_lost_closure: (() => void) | null = null
  ) {
    const session = new DBusSession();
    await session._init(appID, name_acquired_closure, name_lost_closure);
    return session;
  }

  private sessionID!: number;
  private connection!: Gio.DBusConnection;

  private constructor() {}

  private async _init(
    appID: string,
    name_acquired_closure: (() => void) | null = null,
    name_lost_closure: (() => void) | null = null
  ) {
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

  public exportService(service: Gio.DBusExportedObject, path: string) {
    service.export(this.connection, path);
  }

  public close() {
    Gio.bus_unown_name(this.sessionID);
  }
}
