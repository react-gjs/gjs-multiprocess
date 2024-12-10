import GLib from "gi://GLib?version=2.0";

type GMainLoop = GLib.MainLoop & {
  runAsync(): Promise<void>;
};

export class Mainloop {
  static getMainLoop(): GMainLoop {
    const loop = new GLib.MainLoop(null, false) as GMainLoop;
    if (typeof loop.runAsync === "undefined") {
      Object.defineProperty(loop, "runAsync", {
        value: runAsyncPolyfill,
      });
    }
    return loop;
  }

  private static _gMainLoop = new GLib.MainLoop(null, false) as GMainLoop;
  private static _isRunning = false;
  private static _exitCode = 0;

  static start() {
    if (this._isRunning) {
      throw new Error("Mainloop is already running.");
    }

    this._isRunning = true;

    return this._gMainLoop.runAsync().then(() => this._exitCode);
  }

  static quit(exitCode = 0) {
    this._exitCode = exitCode;
    this._isRunning = false;
    this._gMainLoop.quit();
  }
}

function runAsyncPolyfill(this: GLib.MainLoop) {
  const p = new Promise<void>((resolve, reject) => {
    GLib.idle_add(-10000, () => {
      try {
        resolve(this.run());
      } catch (e) {
        reject(e);
      }
      return GLib.SOURCE_REMOVE;
    });
  });

  return p;
}
