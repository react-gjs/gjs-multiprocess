import { attempt } from "./attempt";
import { Serializer } from "./serializer";

export const serializeError = (error: any) => {
  const toParse: Record<string, any> = {};

  if (error instanceof Error) {
    Object.assign(toParse, error);
    toParse.name = error.name;
    toParse.message = error.message;
    toParse.stack = error.stack;
  } else {
    toParse.message = String(error);
  }

  return attempt(() => Serializer.stringify(toParse)) ?? "{}";
};
