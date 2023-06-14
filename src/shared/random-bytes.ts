import { Buffer } from "buffer";
import { microtask } from "./microtask";

const MAX_BYTES = 65536;
const MAX_UINT32 = 4294967295;

function getRandomValues(buf: Buffer) {
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.floor(Math.random() * 65536);
  }
}

function randomBytes(size: number, cb?: (_: null, bytes: Buffer) => void) {
  if (size > MAX_UINT32)
    throw new RangeError("requested too many random bytes");
  const bytes = Buffer.allocUnsafe(size);
  if (size > 0) {
    if (size > MAX_BYTES) {
      for (let generated = 0; generated < size; generated += MAX_BYTES) {
        getRandomValues(bytes.slice(generated, generated + MAX_BYTES));
      }
    } else {
      getRandomValues(bytes);
    }
  }
  if (typeof cb === "function") {
    return microtask(function () {
      cb(null, bytes);
    });
  }
  return bytes;
}

// @ts-expect-error
module.exports = randomBytes;
