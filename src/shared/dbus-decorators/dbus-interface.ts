import { Metadata } from "../decorators/metadata";
import { padLines } from "../pad-lines";

type MethodArguments = Array<typeof String | typeof Number | typeof Boolean>;

export type DBusExportedMethod = {
  name: string;
  getArguments: () => MethodArguments;
};

const ExportedMethods = Metadata.defineForClass(
  "dbus:exported",
  (): DBusExportedMethod[] => [],
);

const isCapitalized = (str: string) => str[0] === str[0]!.toUpperCase();

export const Export: MethodDecorator = (proto, key) => {
  if (typeof key !== "string") {
    throw new Error(
      "Export decorator can only be used on methods with a string names.",
    );
  }

  if (!isCapitalized(key)) {
    throw new Error("DBus exported methods must start with a capital letter.");
  }

  const methodList = ExportedMethods.get(proto);

  methodList.push({
    name: key,
    getArguments: () => {
      const methodArgTypes: MethodArguments = Reflect.getMetadata("design:paramtypes", proto, key) ?? [];
      return methodArgTypes;
    },
  });
};

export const getExportedMethods = (target: any) => {
  return ExportedMethods.get(target) ?? [];
};

// export const DBusInterface = <T extends object>(
//   proto: new (...args: any[]) => T
// ) => {
//   return WithInitializers(proto);
// };

export const compileInterface = (
  name: string,
  constructor: new(...args: any[]) => object,
) => {
  const exportedMethods = getExportedMethods(constructor.prototype);

  const methodSignatures: string[] = [];

  for (const method of exportedMethods) {
    const signature = /* xml */ `<method name="${method.name}">
${
      method
        .getArguments()
        .map((argType, i) => {
          switch (argType) {
            case String:
              return /* xml */ `  <arg type="s" name="arg${i}"/>`;
            case Number:
              return /* xml */ `  <arg type="i" name="arg${i}"/>`;
            case Boolean:
              return /* xml */ `  <arg type="b" name="arg${i}"/>`;
          }
        })
        .join("\n")
    }
</method>`;

    methodSignatures.push(signature);
  }

  const signature = /* xml */ `<node>
  <interface name="${name}">
${padLines(methodSignatures.join("\n"), "    ")}
  </interface>
</node>`;

  return signature;
};
