import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @xyflow/react renders nothing in jsdom without these measurement polyfills.
// (Official React Flow testing guide; uses globalThis so tsc needs no @types/node global.)
class ResizeObserverMock {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    setTimeout(() => this.cb([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver), 0);
  }
  unobserve() {}
  disconnect() {}
}
class DOMMatrixReadOnlyMock {
  m22: number;
  constructor(t?: string) {
    const s = t?.match(/scale\(([\d.]+)\)/)?.[1];
    this.m22 = s !== undefined ? +s : 1;
  }
}
let init = false;
function mockReactFlow() {
  if (init) return;
  init = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;
  Object.defineProperties(globalThis.HTMLElement.prototype, {
    offsetHeight: { get() { return parseFloat((this as HTMLElement).style.height) || 1; } },
    offsetWidth: { get() { return parseFloat((this as HTMLElement).style.width) || 1; } },
  });
  (globalThis.SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
}
mockReactFlow();
afterEach(() => cleanup());
