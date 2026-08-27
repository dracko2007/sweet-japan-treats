import "@testing-library/jest-dom";

// `Promise.withResolvers` é ES2024 — só chega nativo a partir do Node 22/23.
// Este projeto roda os testes em Node 20 (ver `node --version`), então o
// polyfill evita todo teste que usa o padrão (ex.: simular uma Promise
// pendente de login) de quebrar com "Promise.withResolvers is not a
// function". Produção roda no navegador, que já suporta nativamente.
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// `matchMedia` não existe no jsdom, e vários componentes leem no primeiro
// render. O guard é para os testes de `api/` e `shared/`, que são lógica pura e
// rodam com `--environment node`: sem ele, este setup global quebra na hora de
// tocar `window` e nenhum teste de servidor chega a executar.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
