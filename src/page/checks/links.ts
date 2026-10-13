import { accessibleName, isRendered } from '../dom';
import type { Check, Finding } from '../types';

const VAGUE_TEXT = new Set([
  'click here', 'click', 'here', 'more', 'read more', 'learn more', 'more info', 'details',
  'link', 'this link', 'this', 'page', 'this page', 'view', 'view more', 'go', 'continue',
]);

const NEW_TAB_HINT = /new (tab|window)|external/i;

function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function areNeighbours(a: Element, b: Element): boolean {
  return a.parentElement === b.parentElement || a.parentElement?.parentElement === b.parentElement?.parentElement;
}

export const links: Check = (doc) => {
  const findings: Finding[] = [];
  let previous: HTMLAnchorElement | null = null;

  for (const link of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    if (!isRendered(link)) continue;

    const name = accessibleName(link);
    const href = (link.getAttribute('href') ?? '').trim();
    const goesNowhere = href === '' || href === '#' || /^javascript:/i.test(href);

    if (!name) {
      findings.push({
        el: link,
        severity: 'error',
        rule: 'link-name',
        message: 'Link has no text.',
        fix: 'Add link text, an aria-label, or alt text on the image inside the link.',
        label: 'no text',
      });
    } else if (VAGUE_TEXT.has(comparable(name))) {
      findings.push({
        el: link,
        severity: 'warning',
        rule: 'link-purpose',
        message: `Link text "${name}" doesn't say where it goes.`,
        fix: 'Use text that makes sense on its own, e.g. "Read the pricing guide".',
        label: 'vague text',
      });
    }

    if (goesNowhere && link.getAttribute('role') !== 'button') {
      findings.push({
        el: link,
        severity: 'warning',
        rule: 'link-as-button',
        message: 'Link does not go anywhere.',
        fix: 'Use a <button> for actions, or point href at a real destination.',
        label: 'no destination',
      });
    }

    if (link.target === '_blank' && !NEW_TAB_HINT.test(name)) {
      findings.push({
        el: link,
        severity: 'warning',
        rule: 'new-tab',
        message: 'Link opens a new tab without saying so.',
        fix: 'Mention it in the link text, e.g. "(opens in a new tab)". Visually hidden text works too.',
        label: 'new tab',
      });
    }

    if (previous && !goesNowhere && previous.href === link.href && areNeighbours(previous, link)) {
      findings.push({
        el: link,
        severity: 'warning',
        rule: 'duplicate-link',
        message: 'Repeats the link right before it.',
        fix: 'Combine adjacent links to the same page (such as an image and its caption) into one link.',
        label: 'duplicate',
      });
    }

    previous = link;
  }

  return { findings };
};
