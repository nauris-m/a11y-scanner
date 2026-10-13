export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value
    .replace(/[^\w-]/g, (ch) => `\\${ch}`)
    .replace(/^(-?)(\d)/, (_match, dash: string, digit: string) => `${dash}\\3${digit} `);
}

/** Builds a selector that matches exactly this element from the document root. */
export function uniqueSelector(el: Element): string {
  const doc = el.ownerDocument;
  const parts: string[] = [];

  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.id) {
      const idSelector = `#${cssEscape(node.id)}`;
      if (doc.querySelectorAll(idSelector).length === 1) {
        parts.unshift(idSelector);
        break;
      }
    }

    const tag = node.localName;
    const parent = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const sameTag = Array.from(parent.children).filter((child) => child.localName === tag);
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag);
  }

  return parts.join(' > ');
}

export function snippet(el: Element, max = 200): string {
  const html = el.outerHTML;
  return html.length > max ? `${html.slice(0, max - 1)}…` : html;
}

type VisibilityCheckable = Element & { checkVisibility?: (options?: object) => boolean };

/** True if the element is rendered and not hidden with display/visibility/hidden. */
export function isRendered(el: Element): boolean {
  const checkable = el as VisibilityCheckable;
  if (typeof checkable.checkVisibility === 'function') {
    return checkable.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  }

  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.hasAttribute('hidden') || getComputedStyle(node).display === 'none') return false;
  }
  return getComputedStyle(el).visibility !== 'hidden';
}

const SKIPPED_CONTENT = 'script, style, template, noscript';

function isHiddenFromAssistiveTech(el: Element): boolean {
  return el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden');
}

function isLabelable(el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

/** Text a screen reader would derive from a node's content (simplified accname). */
function textAlternative(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element) || isHiddenFromAssistiveTech(node) || node.matches(SKIPPED_CONTENT)) return '';

  const ariaLabel = node.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ` ${ariaLabel} `;
  if (node instanceof HTMLImageElement) return ` ${node.alt} `;
  if (isLabelable(node)) return '';

  return Array.from(node.childNodes).map(textAlternative).join('');
}

function contentText(el: Element): string {
  return normalizeSpace(Array.from(el.childNodes).map(textAlternative).join(''));
}

/** Name given explicitly by the author: aria-labelledby, aria-label or title. */
export function authorName(el: Element): string {
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = normalizeSpace(
      labelledBy
        .split(/\s+/)
        .map((id) => el.ownerDocument.getElementById(id))
        .map((ref) => (ref ? ref.getAttribute('aria-label') || contentText(ref) : ''))
        .join(' ')
    );
    if (text) return text;
  }

  return normalizeSpace(el.getAttribute('aria-label') ?? '') || normalizeSpace(el.getAttribute('title') ?? '');
}

/**
 * Simplified accessible name. Placeholder is deliberately ignored so that
 * placeholder-only labelling can be reported.
 */
export function accessibleName(el: Element): string {
  const explicit = normalizeSpace(el.getAttribute('aria-label') ?? '');
  const fromAuthor = el.hasAttribute('aria-labelledby') ? authorName(el) : explicit;
  if (fromAuthor) return fromAuthor;

  let native = '';
  if (el instanceof HTMLInputElement && el.type === 'image') {
    native = normalizeSpace(el.alt);
  } else if (isLabelable(el)) {
    native = normalizeSpace(Array.from(el.labels ?? []).map(contentText).join(' '));
  } else if (el instanceof HTMLImageElement) {
    native = normalizeSpace(el.alt);
  } else {
    native = contentText(el);
  }

  return native || normalizeSpace(el.getAttribute('title') ?? '');
}
