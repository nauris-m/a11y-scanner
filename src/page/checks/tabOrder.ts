import { isRendered } from '../dom';
import type { Check, Finding, Mark } from '../types';

const CANDIDATES = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'summary',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ');

const NATIVE_INTERACTIVE = new Set([
  'a', 'area', 'button', 'input', 'select', 'textarea', 'summary', 'iframe', 'audio', 'video', 'details', 'embed', 'object',
]);

function isTabbable(el: HTMLElement): boolean {
  if (el.tabIndex < 0 || el.matches(':disabled') || el.closest('[inert]')) return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  return isRendered(el);
}

/** Returns tabbable elements in the order the browser visits them. */
export function sequentialFocusOrder(doc: Document): HTMLElement[] {
  const focusable = Array.from(doc.querySelectorAll<HTMLElement>(CANDIDATES)).filter(isTabbable);
  // Positive tabindex values go first (ascending, DOM order for ties), then everything else in DOM order.
  const positive = focusable.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
  return [...positive, ...focusable.filter((el) => el.tabIndex === 0)];
}

export const tabOrder: Check = (doc) => {
  const order = sequentialFocusOrder(doc);
  const findings: Finding[] = [];

  for (const el of order) {
    if (el.tabIndex > 0) {
      findings.push({
        el,
        severity: 'error',
        rule: 'positive-tabindex',
        message: `tabindex="${el.tabIndex}" moves this element ahead of the natural tab order.`,
        fix: 'Remove the tabindex (or use tabindex="0") and change the DOM order instead.',
        label: `tabindex=${el.tabIndex}`,
      });
    }

    if (
      el.hasAttribute('tabindex') &&
      !NATIVE_INTERACTIVE.has(el.localName) &&
      !el.hasAttribute('role') &&
      !el.isContentEditable
    ) {
      findings.push({
        el,
        severity: 'warning',
        rule: 'focusable-without-role',
        message: 'Element is focusable but has no interactive role.',
        fix: 'Use a native control such as <button>, or add a role, an accessible name and keyboard handling.',
        label: 'no role',
      });
    }
  }

  const marks: Mark[] = order.map((el, index) => ({
    el,
    kind: el.tabIndex > 0 ? 'error' : 'info',
    label: String(index + 1),
  }));

  return {
    findings,
    marks,
    note: `${order.length} elements in the tab order. Each is numbered on the page.`,
  };
};
