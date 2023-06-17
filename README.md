# gjs-multiprocess

A simple API for running child-processes and comunicating with them via DBus.

## Usage

```ts
// worker.js

export function calculatePi(digits) {
  // some calculations
  return result;
}
```

```ts
// main.js

const server = await startServer("org.my.app");

const client = await server.createClient("./worker.js");
// note: path to the worker must be relative to the current working directory or absolute

const pi = await client.invoke.calculatePi(1000);

console.log(pi);

client.terminate();
server.close();
```

## Exposing methods to the client

Main process can expose methods to the client by passing an object to the `createClient` function.

```ts
// main.js

const mainProcessApi = {
  // Pass a log message to the Logger class in the main process
  log: (message) => Logger.info(message),
};

const client = await server.createClient("./worker.js", mainProcessApi);
```

```ts
// worker.js

export function doWork(message) {
  try {
    // ...
  } catch (error) {
    Subprocess.invoke.log(error.message);
  }
}
```

## TypeScript

If you are using TypeScript you will want to have the client and Subprocess fully typed. That cannot be done automatically, since it's impossible atm to infer type definitions from a filepath. But you can fairly easily provide those typings manually:

### Worker Typings

```ts
// worker.ts

export function calculatePi(digits: number): string {
  // some calculations
  return result;
}

export function reverse(str: string): string {
  return str.split("").reverse().join("");
}
```

```ts
import type * as Worker from "./worker";

const server = await startServer("org.my.app");

const client = await server.createClient<typeof Worker>("./worker.ts");
```

### Main Process Typings

In case of the main process exported methods, those must be declared on a interface in the global scope called `MainProcessApi`.

```ts
// main.ts

const mainProcessApi = {
  // Pass a log message to the Logger class in the main process
  log: (message: string) => Logger.info(message),
};

const client = await server.createClient("./worker.ts", mainProcessApi);
```

```ts
// worker.ts

declare global {
  // Methods in this interface should match the methods provided by the main process
  interface MainProcessApi {
    log(message: string): void;
  }
}

Subprocess.invoke.log("Hello from the worker!");
```
