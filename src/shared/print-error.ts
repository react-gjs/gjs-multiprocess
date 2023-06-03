export const printError = (err: any) => {
  if (typeof err === "object") {
    let log = "";
    if (err.message) {
      log += err.message + "\n";
    }
    if (err.stack) {
      log += err.stack;
    }

    if (log) {
      console.error(log);
      return;
    }
  }

  console.error(String(err));
};
