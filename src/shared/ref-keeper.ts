export class RefKeeper {
  static {
    Object.defineProperty(globalThis, "__gest_refs", {
      value: RefKeeper,
    });
  }

  static store = new Set();

  static ref(obj: object) {
    this.store.add(obj);
  }

  static unref(obj: object) {
    this.store.delete(obj);
  }
}
