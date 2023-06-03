export class IdGenerator {
  private _next = 1;

  next() {
    return String(this._next++);
  }
}
