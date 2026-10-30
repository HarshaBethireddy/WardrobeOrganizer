import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { MotionGlobalConfig } from 'motion/react';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

MotionGlobalConfig.skipAnimations = true;

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
class Noop { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
const g = globalThis as Record<string, unknown>;
g.ResizeObserver ??= Noop;
g.IntersectionObserver ??= Noop;
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:mock';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function () {};
