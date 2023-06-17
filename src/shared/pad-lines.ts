export const padLines = (text: string, pad: string) => {
  return text
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
};
