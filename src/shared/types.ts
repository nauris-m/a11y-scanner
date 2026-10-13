export type CheckType = 'general' | 'tabOrder' | 'forms' | 'links';

export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  rule: string;
  message: string;
  fix?: string;
  helpUrl?: string;
  snippet: string;
  /** Unique CSS selector for the element; absent when it can't be addressed from the document (e.g. shadow DOM). */
  selector?: string;
}

export interface ScanResult {
  check: CheckType;
  url: string;
  timestamp: string;
  issues: Issue[];
  note?: string;
}

/** API the injected page runtime exposes in the extension's isolated world. */
export interface PageApi {
  run(check: CheckType): Promise<ScanResult>;
  focus(selector: string): boolean;
  clear(): void;
}

declare global {
  interface Window {
    __a11yScanner?: PageApi;
  }
}
