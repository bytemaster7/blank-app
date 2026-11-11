let counter = 0;

/** Short unique id; does not rely on crypto so it also works in tests and old browsers. */
export function newId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}
