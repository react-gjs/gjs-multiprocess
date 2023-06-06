export function foo() {
  return "foo";
}

export function bar(str) {
  return str.length;
}

export function baz() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("baz");
    }, 100);
  });
}

export function qux(str) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(str.length);
    }, 100);
  });
}

export function quux() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("looong");
    }, 5000);
  });
}

export async function quuz(str) {
  const l = await Subprocess.invoke.loopback(str);
  return l;
}

export let internalCounter = 1;
export function bumpInternalCounter() {
  return internalCounter++;
}
