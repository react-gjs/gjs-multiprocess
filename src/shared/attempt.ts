export const attempt = <R>(action: () => R): R | null => {
  try {
    return action();
  } catch (error) {
    console.error(error);
    return null;
  }
};
