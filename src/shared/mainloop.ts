const { mainloop } = imports;

export class Mainloop {
  private static _name = "default";
  private static _isRunning = false;
  private static _exitCode = 0;

  static start(name?: string): number {
    if (this._isRunning) {
      throw new Error("Mainloop is already running.");
    }

    if (name) {
      this._name = name;
    }

    this._isRunning = true;
    mainloop.run(this._name);

    return this._exitCode;
  }

  static quit(exitCode = 0) {
    this._exitCode = exitCode;
    this._isRunning = false;
    mainloop.quit(this._name);
  }
}
