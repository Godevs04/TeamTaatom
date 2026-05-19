declare var global: typeof globalThis;

declare namespace NodeJS {
  type Timeout = ReturnType<typeof setTimeout>;
}
