import type { CheckType, Issue, PageApi, ScanResult } from '../shared/types';
import { forms } from './checks/forms';
import { general } from './checks/general';
import { links } from './checks/links';
import { tabOrder } from './checks/tabOrder';
import { snippet, uniqueSelector } from './dom';
import { clearOverlay, flash, mark } from './overlay';
import type { Check } from './types';

const CHECKS: Record<CheckType, Check> = { general, tabOrder, forms, links };

async function run(check: CheckType): Promise<ScanResult> {
  clearOverlay();
  const { findings, marks, note } = await CHECKS[check](document);

  for (const m of marks ?? findings.map((f) => ({ el: f.el, kind: f.severity, label: f.label ?? f.rule }))) {
    mark(m.el, m.kind, m.label);
  }

  const issues: Issue[] = findings.map((f) => ({
    severity: f.severity,
    rule: f.rule,
    message: f.message,
    fix: f.fix,
    helpUrl: f.helpUrl,
    snippet: snippet(f.el),
    selector: f.el.getRootNode() === document ? uniqueSelector(f.el) : undefined,
  }));
  issues.sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error'));

  return { check, url: location.href, timestamp: new Date().toISOString(), issues, note };
}

function focus(selector: string): boolean {
  let el: Element | null;
  try {
    el = document.querySelector(selector);
  } catch {
    return false;
  }
  if (!el) return false;
  flash(el);
  return true;
}

// The popup injects this file once per document; later calls reuse the same runtime.
if (!window.__a11yScanner) {
  const api: PageApi = { run, focus, clear: clearOverlay };
  window.__a11yScanner = api;
}
