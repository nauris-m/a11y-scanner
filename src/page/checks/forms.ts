import { accessibleName, authorName, isRendered } from '../dom';
import type { Check, Finding } from '../types';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// Buttons get their name from their value; hidden inputs are never presented.
const SKIPPED_INPUT_TYPES = new Set(['hidden', 'submit', 'reset', 'button']);

function legendText(fieldset: HTMLFieldSetElement): string {
  const legend = Array.from(fieldset.children).find((child) => child.localName === 'legend');
  return legend?.textContent?.trim() ?? '';
}

function hasGroupLabel(el: Element): boolean {
  const fieldset = el.closest('fieldset');
  if (fieldset && legendText(fieldset)) return true;
  const group = el.closest('[role="radiogroup"], [role="group"]');
  return group !== null && authorName(group) !== '';
}

export const forms: Check = (doc) => {
  const findings: Finding[] = [];
  const controls = Array.from(doc.querySelectorAll<FormControl>('input, select, textarea')).filter(
    (el) => !(el instanceof HTMLInputElement && SKIPPED_INPUT_TYPES.has(el.type)) && isRendered(el)
  );

  for (const el of controls) {
    if (accessibleName(el)) continue;

    if (el.getAttribute('placeholder')?.trim()) {
      findings.push({
        el,
        severity: 'warning',
        rule: 'placeholder-label',
        message: 'Placeholder text is the only label.',
        fix: 'Placeholders disappear while typing and often have low contrast. Add a visible <label> as well.',
        label: 'placeholder only',
      });
    } else {
      findings.push({
        el,
        severity: 'error',
        rule: 'missing-label',
        message: 'Form control has no label.',
        fix: 'Add a <label for="…">, wrap the control in a <label>, or use aria-labelledby.',
        label: 'no label',
      });
    }
  }

  const radioGroups: HTMLInputElement[][] = [];
  for (const el of controls) {
    if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name) continue;
    const group = radioGroups.find((g) => g[0].name === el.name && g[0].form === el.form);
    if (group) group.push(el);
    else radioGroups.push([el]);
  }

  for (const [first, ...rest] of radioGroups) {
    if (rest.length === 0 || hasGroupLabel(first)) continue;
    findings.push({
      el: first,
      severity: 'warning',
      rule: 'radio-group-label',
      message: `Radio group "${first.name}" has no group label.`,
      fix: 'Wrap the options in a <fieldset> with a <legend>, or use role="radiogroup" with aria-labelledby.',
      label: 'no group label',
    });
  }

  for (const fieldset of Array.from(doc.querySelectorAll('fieldset'))) {
    if (!isRendered(fieldset) || legendText(fieldset)) continue;
    findings.push({
      el: fieldset,
      severity: 'warning',
      rule: 'fieldset-legend',
      message: 'Fieldset has no legend.',
      fix: 'Add a <legend> as the first child that describes the group.',
      label: 'no legend',
    });
  }

  return { findings };
};
