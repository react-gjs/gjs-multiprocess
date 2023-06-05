export const serializeError = (error: Error) => {
  const toParse: Record<string, any> = {};

  if (error instanceof Error) {
    Object.assign(toParse, error);
    toParse.name = error.name;
    toParse.message = error.message;
    toParse.stack = error.stack;
  } else {
    toParse.message = String(error);
  }

  return JSON.stringify(toParse);
};
