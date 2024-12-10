import "reflect-metadata";

export type MetadataReference<T> = {
  get: (proto: any) => T;
  set: (proto: any, value: T) => void;
};

export class Metadata {
  public static defineForClass<T>(
    name: string,
    getDefaultValue: (proto: any) => T,
  ): MetadataReference<T> {
    return {
      get: (proto: any) => {
        const value = Reflect.getMetadata(name, proto);

        if (value) {
          return value as T;
        }

        const initialValue = getDefaultValue(proto);

        Reflect.defineMetadata(name, initialValue, proto);

        return initialValue as T;
      },
      set: (proto: any, value: T) => {
        Reflect.defineMetadata(name, value, proto);
      },
    };
  }

  public static defineForProperty<T>(
    name: string,
    propertyKey: string,
    defaultValue: T | ((proto: any) => T),
  ): MetadataReference<T> {
    return {
      get: (proto: any) => {
        const value = Reflect.getMetadata(name, proto, propertyKey);

        if (value) {
          return value as T;
        }

        if (typeof defaultValue === "function") {
          defaultValue = (defaultValue as Function)(proto);
        }

        Reflect.defineMetadata(name, defaultValue, proto, propertyKey);

        return defaultValue as T;
      },
      set: (proto: any, value: T) => {
        Reflect.defineMetadata(name, value, proto, propertyKey);
      },
    };
  }
}
