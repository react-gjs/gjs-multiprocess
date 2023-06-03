import Gio from "gi://Gio?version=2.0";

type FnInfo = {
  args: any[];
  returnType: any;
};

type Merge<T extends FnInfo, U extends FnInfo> = {
  args: [...T["args"], ...U["args"]];
  returnType: [U["returnType"]] extends [void]
    ? T["returnType"]
    : U["returnType"];
};

type ArgTypeMap = {
  s: string;
  u: number;
  b: boolean;
  a: any[];
};

type GetArgType<T extends string> = T extends keyof ArgTypeMap
  ? ArgTypeMap[T]
  : never;

type ParseAttribute<
  A extends string,
  N extends "type" | "direction" | "name"
> = {
  type: A extends `${string}type="${infer ArgType}"${string}` ? ArgType : never;
  direction: A extends `${string}direction="${infer Direction}"${string}`
    ? Direction
    : "in";
  name: A extends `${string}name="${infer ArgName}"${string}` ? ArgName : never;
}[N];

type ExtractInterfaceMethodArguments<T extends string> =
  T extends `${string}<arg ${infer Attr}/>${infer Rest}`
    ? Merge<
        ExtractInterfaceMethodArguments<Rest>,
        {
          args: ParseAttribute<Attr, "direction"> extends "in"
            ? [GetArgType<ParseAttribute<Attr, "type">>]
            : [];
          returnType: ParseAttribute<Attr, "direction"> extends "out"
            ? GetArgType<ParseAttribute<Attr, "type">>
            : void;
        }
      >
    : {
        args: [];
        returnType: void;
      };

type RemoteFunctionFor<T extends FnInfo> = (
  ...args: [...T["args"], (value: [T["returnType"]], err: unknown) => void]
) => void;

type SyncFunctionFor<T extends FnInfo> = (
  ...args: T["args"]
) => T["returnType"];

type AsyncFunctionFor<T extends FnInfo> = (
  ...args: T["args"]
) => Promise<T["returnType"]>;

type InterfaceMethods<T extends string> =
  T extends `${string}<method name="${infer MethodName}">${infer Args}</method>${infer Rest}`
    ? {
        [K in MethodName as `${K}Remote`]: RemoteFunctionFor<
          ExtractInterfaceMethodArguments<Args>
        >;
      } & {
        [K in MethodName as `${K}Sync`]: SyncFunctionFor<
          ExtractInterfaceMethodArguments<Args>
        >;
      } & {
        [K in MethodName as `${K}Async`]: AsyncFunctionFor<
          ExtractInterfaceMethodArguments<Args>
        >;
      } & InterfaceMethods<Rest>
    : {};

type FunctionImplFor<T extends FnInfo> = (
  ...args: T["args"]
) => T["returnType"];

type ImplInterface<T extends string> =
  T extends `${string}<method name="${infer MethodName}">${infer Args}</method>${infer Rest}`
    ? {
        [K in MethodName as `${K}`]: FunctionImplFor<
          ExtractInterfaceMethodArguments<Args>
        >;
      } & ImplInterface<Rest>
    : {};

export type XmlInterface<F extends (...args: any[]) => string> = ImplInterface<
  ReturnType<F>
>;

export const createDBusProxy = <T extends string>(interfaceXml: T) => {
  return Gio.DBusProxy.makeProxyWrapper<InterfaceMethods<T>>(interfaceXml);
};
