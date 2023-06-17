export class References {
  static {
    Object.defineProperty(globalThis, "__multiprocess_refs", {
      value: References,
      configurable: false,
      writable: false,
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
