import axe from 'axe-core';
import { OVERLAY_TAG } from '../overlay';
import type { Check, Finding } from '../types';

/** Full WCAG scan using axe-core. */
export const general: Check = async () => {
  const results = await axe.run(
    { exclude: [[OVERLAY_TAG]] },
    { resultTypes: ['violations'], elementRef: true }
  );

  const findings: Finding[] = [];
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      if (!node.element) continue;
      findings.push({
        el: node.element,
        severity: violation.impact === 'critical' || violation.impact === 'serious' ? 'error' : 'warning',
        rule: violation.id,
        message: violation.help,
        fix: node.failureSummary,
        helpUrl: violation.helpUrl,
      });
    }
  }

  return {
    findings,
    note: 'Automated rules catch only part of WCAG. Also test with a keyboard and a screen reader.',
  };
};
