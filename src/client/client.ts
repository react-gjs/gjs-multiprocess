import System from "system";
import { DBusSession } from "../shared/dbus-session";
import { Mainloop } from "../shared/mainloop";
import { printError } from "../shared/print-error";
import { ClientService } from "./service";

export const startClient = async (appID: string, parentProcessID: string) => {
  try {
    const session = await DBusSession.start(appID);
    const service = new ClientService(session, appID, parentProcessID);

    session.exportService(service);

    await service.server.SubprocessReadyAsync(appID);
  } catch (error) {
    Mainloop.quit(1);
    printError(error);
  }
};

const main = () => {
  const parentProcessID = ARGV[0];
  const clientName = ARGV[1];

  if (!clientName) {
    console.error("Client Name not specified.");
    System.exit(1);
    return;
  }

  if (!parentProcessID) {
    console.error("Parent Process ID not specified.");
    System.exit(1);
    return;
  }

  Mainloop.start()
    .then((exitCode) => {
      System.exit(exitCode);
    })
    .catch((err) => {
      printError(err);
      System.exit(1);
    });

  startClient(clientName, parentProcessID).catch(printError);
};

main();
