import { Metadata } from "./metadata";

export type Initializer = <T extends object>(thisInstance: T) => void;

const InitializersMetadata = Metadata.defineForClass(
  "initializers",
  (): Initializer[] => [],
);

export const WithInitializers = <T extends object>(
  proto: new(...args: any[]) => T,
) => {
  return new Proxy(proto, {
    construct: (_, args) => {
      const initializers = InitializersMetadata.get(proto);

      const instance = new proto(...args);
      for (const initializer of initializers) {
        initializer(instance);
      }

      return instance as any;
    },
  });
};

export const Context = <T extends object>(proto: T) => {
  const initializers = InitializersMetadata.get(proto);

  return {
    addInitializer: (initializer: Initializer) => {
      initializers.push(initializer);
    },
  };
};
