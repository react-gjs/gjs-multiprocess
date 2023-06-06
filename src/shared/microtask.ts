export const resolved = Promise.resolve();

export const microtask = (fn: () => void) => {
  resolved.then(fn).catch((error) => {
    setTimeout(() => {
      console.error(error);
    });
  });
};
