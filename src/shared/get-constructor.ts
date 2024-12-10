export const getConstructor = <T extends object>(
  target: T,
): new(...args: any[]) => T => {
  return Reflect.getPrototypeOf(target)!.constructor as any;
};
