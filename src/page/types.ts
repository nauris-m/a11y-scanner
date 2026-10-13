import type { Severity } from '../shared/types';

export type MarkKind = Severity | 'info' | 'focus';

export interface Finding {
  el: Element;
  severity: Severity;
  rule: string;
  message: string;
  fix?: string;
  helpUrl?: string;
  /** Short text drawn next to the element on the page. Defaults to the rule id. */
  label?: string;
}

export interface Mark {
  el: Element;
  kind: MarkKind;
  label?: string;
}

export interface CheckOutput {
  findings: Finding[];
  /** What to draw on the page. Defaults to one mark per finding. */
  marks?: Mark[];
  note?: string;
}

export type Check = (doc: Document) => CheckOutput | Promise<CheckOutput>;
