import type { MarkKind } from './types';

/**
 * Highlights live in a single shadow-DOM layer on top of the page, so the
 * page's own elements, classes and attributes are never modified.
 */
export const OVERLAY_TAG = 'a11y-scanner-overlay';

const STYLE = `
  :host { all: initial; }
  .box {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid;
    border-radius: 2px;
    pointer-events: none;
  }
  .box[hidden] { display: none; }
  .error { border-color: #d93025; background: rgba(217, 48, 37, 0.08); }
  .warning { border-color: #e37400; border-style: dashed; }
  .info { border-color: #1e8e3e; border-style: dashed; }
  .focus { border: 3px solid #3651d4; box-shadow: 0 0 0 4px rgba(54, 81, 212, 0.35); }
  .label {
    position: absolute;
    left: -2px;
    bottom: 100%;
    margin-bottom: 2px;
    max-width: 240px;
    overflow: hidden;
    padding: 1px 5px;
    border-radius: 3px;
    background: #202124;
    color: #fff;
    font: 600 11px/1.4 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .error .label { background: #b3261e; }
  .warning .label { background: #8a4b00; }
  .info .label { background: #146c2e; }
  @media (prefers-reduced-motion: no-preference) {
    .focus { animation: pulse 0.8s ease-in-out 3; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 10px rgba(54, 81, 212, 0.15); } }
  }
`;

interface DrawnMark {
  el: Element;
  box: HTMLDivElement;
}

let host: HTMLElement | null = null;
let layer: ShadowRoot | null = null;
let resizeObserver: ResizeObserver | null = null;
let drawn: DrawnMark[] = [];
let frame = 0;
let focusTimer = 0;

function ensureLayer(): ShadowRoot {
  if (host?.isConnected && layer) return layer;

  host = document.createElement(OVERLAY_TAG);
  host.style.cssText =
    'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;';
  layer = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  layer.append(style);
  document.documentElement.append(host);

  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(document.documentElement);
  return layer;
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(render);
}

function render(): void {
  frame = 0;
  if (!host) return;

  const origin = host.getBoundingClientRect();
  for (const { el, box } of drawn) {
    const rect = el.getBoundingClientRect();
    box.hidden = !el.isConnected || (rect.width === 0 && rect.height === 0);
    if (box.hidden) continue;
    box.style.top = `${rect.top - origin.top}px`;
    box.style.left = `${rect.left - origin.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }
}

export function mark(el: Element, kind: MarkKind, label?: string): HTMLDivElement {
  const box = document.createElement('div');
  box.className = `box ${kind}`;
  if (label) {
    const tag = document.createElement('span');
    tag.className = 'label';
    tag.textContent = label;
    box.append(tag);
  }
  ensureLayer().append(box);
  drawn.push({ el, box });
  schedule();
  return box;
}

function unmark(box: HTMLDivElement): void {
  box.remove();
  drawn = drawn.filter((entry) => entry.box !== box);
}

export function flash(el: Element): void {
  window.clearTimeout(focusTimer);
  drawn.filter((entry) => entry.box.classList.contains('focus')).forEach((entry) => unmark(entry.box));

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const box = mark(el, 'focus');
  focusTimer = window.setTimeout(() => unmark(box), 2500);
}

export function clearOverlay(): void {
  cancelAnimationFrame(frame);
  window.clearTimeout(focusTimer);
  frame = 0;
  window.removeEventListener('scroll', schedule, true);
  window.removeEventListener('resize', schedule);
  resizeObserver?.disconnect();
  resizeObserver = null;
  host?.remove();
  host = null;
  layer = null;
  drawn = [];
}
