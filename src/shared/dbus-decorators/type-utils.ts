type FirstLetter<T extends string> = T extends `${infer F}${infer R}` ? F
  : never;

type IsCapitalized<K extends string> = FirstLetter<K> extends Capitalize<
  FirstLetter<K>
> ? true
  : false;

type IsExportKey<O, K> = K extends string ? O extends Record<K, Function> ? IsCapitalized<K> extends true ? true
    : false
  : false
  : false;

type Concat<S, T extends string> = S extends string ? `${S}${T}` : never;

type AsAsync<F> = F extends (...args: infer A) => infer R ? (...args: A) => Promise<R>
  : never;

type AsRemote<F> = F extends (...args: infer A) => infer R
  ? (...args: [...A, (value: [R], err: unknown) => void]) => void
  : never;

export type InterfaceOf<I extends object> =
  & {
    [
      K in keyof I as IsExportKey<I, K> extends true ? Concat<K, "Async">
        : never
    ]: AsAsync<I[K]>;
  }
  & {
    [
      K in keyof I as IsExportKey<I, K> extends true ? Concat<K, "Sync">
        : never
    ]: I[K];
  }
  & {
    [
      K in keyof I as IsExportKey<I, K> extends true ? Concat<K, "Remote">
        : never
    ]: AsRemote<I[K]>;
  };
