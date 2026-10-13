import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { CheckType, Issue, ScanResult, Severity } from '../shared/types';
import {
  type ActiveTab,
  clearPage,
  describeError,
  focusElement,
  forgetResult,
  getActiveTab,
  loadResult,
  runCheck,
  saveResult,
} from './chromeApi';
import {
  CheckCircleIcon,
  ClearIcon,
  ErrorIcon,
  ExternalIcon,
  FormIcon,
  KeyboardIcon,
  LinkIcon,
  LogoIcon,
  ScanIcon,
  TargetIcon,
  WarningIcon,
} from './icons';

const CHECKS: Array<{ id: CheckType; label: string; description: string; icon: ReactNode }> = [
  { id: 'general', label: 'Full scan', description: 'All WCAG rules via axe', icon: <ScanIcon /> },
  { id: 'tabOrder', label: 'Tab order', description: 'Keyboard focus sequence', icon: <KeyboardIcon /> },
  { id: 'forms', label: 'Forms', description: 'Labels and field groups', icon: <FormIcon /> },
  { id: 'links', label: 'Links', description: 'Link text and targets', icon: <LinkIcon /> },
];

type Filter = 'all' | Severity;

/** Issues that share a rule and message, e.g. every image missing alt text. */
interface IssueGroup {
  key: string;
  severity: Severity;
  rule: string;
  message: string;
  fix?: string;
  helpUrl?: string;
  items: Issue[];
}

const checkLabel = (id: CheckType) => CHECKS.find((c) => c.id === id)?.label ?? id;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function countBySeverity(issues: Issue[]) {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return { errors, warnings: issues.length - errors };
}

function summarize(result: ScanResult): string {
  const { errors, warnings } = countBySeverity(result.issues);
  return `${checkLabel(result.check)}: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}.`;
}

function groupIssues(issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const key = `${issue.severity}|${issue.rule}|${issue.message}`;
    const group = groups.get(key);
    if (group) {
      group.items.push(issue);
    } else {
      const { severity, rule, message, fix, helpUrl } = issue;
      groups.set(key, { key, severity, rule, message, fix, helpUrl, items: [issue] });
    }
  }
  return Array.from(groups.values());
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

export function App() {
  const [tab, setTab] = useState<ActiveTab | null>(null);
  const [running, setRunning] = useState<CheckType | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveTab();
      if (cancelled) return;
      setTab(active);
      if (!active) {
        setError('No active tab found.');
        return;
      }
      const restored = await loadResult(active);
      if (!cancelled && restored) {
        setResult(restored);
        setStatus(`Showing earlier results. ${summarize(restored)}`);
      }
    })().catch((e) => {
      if (!cancelled) setError(describeError(e));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Buttons use aria-disabled instead of disabled so keyboard focus isn't lost while a check runs.
  const busy = running !== null || tab === null;

  const handleRun = async (check: CheckType) => {
    if (busy || !tab) return;
    setRunning(check);
    setError('');
    setStatus(`Running ${checkLabel(check).toLowerCase()} check…`);
    try {
      const scan = await runCheck(tab.id, check);
      setResult(scan);
      setStatus(summarize(scan));
      await saveResult(tab.id, scan);
    } catch (e) {
      console.error(e);
      setResult(null);
      setStatus('');
      setError(describeError(e));
    } finally {
      setRunning(null);
    }
  };

  const handleClear = async () => {
    if (busy || !tab) return;
    setError('');
    try {
      await clearPage(tab.id);
    } catch {
      // Nothing to clear on pages the extension can't access.
    }
    await forgetResult(tab.id);
    setResult(null);
    setStatus('Highlights cleared.');
  };

  const handleShow = async (selector: string) => {
    if (!tab) return;
    try {
      const found = await focusElement(tab.id, selector);
      if (!found) setStatus('That element is no longer on the page. Run the check again.');
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <main>
      <header className="header">
        <span className="logo">
          <LogoIcon />
        </span>
        <div>
          <h1>Accessibility Scanner</h1>
          <p className="page">{tab ? hostnameOf(tab.url) : 'Loading…'}</p>
        </div>
      </header>

      <section aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="visually-hidden">
          Checks
        </h2>
        <div className="checks">
          {CHECKS.map(({ id, label, description, icon }) => (
            <button
              key={id}
              type="button"
              className={`check${result?.check === id ? ' current' : ''}`}
              aria-disabled={busy}
              onClick={() => handleRun(id)}
            >
              <span className="check-icon">{running === id ? <span className="spinner" /> : icon}</span>
              <span className="check-text">
                <span className="check-label">{running === id ? 'Checking…' : label}</span>
                <span className="check-description">{description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <p role="status" className="visually-hidden">
        {status}
      </p>
      {error && (
        <p role="alert" className="alert">
          <ErrorIcon />
          <span>{error}</span>
        </p>
      )}

      {result ? (
        // Keyed so each new result starts with fresh filter state.
        <Results key={result.timestamp} result={result} busy={busy} onShow={handleShow} onClear={handleClear} />
      ) : (
        !error && <p className="hint">Choose a check to scan this page. Issues are highlighted on the page.</p>
      )}
    </main>
  );
}

interface ResultsProps {
  result: ScanResult;
  busy: boolean;
  onShow: (selector: string) => void;
  onClear: () => void;
}

function Results({ result, busy, onShow, onClear }: ResultsProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const { errors, warnings } = countBySeverity(result.issues);
  const groups = useMemo(() => groupIssues(result.issues), [result]);
  const visible = filter === 'all' ? groups : groups.filter((group) => group.severity === filter);

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: result.issues.length },
    { id: 'error', label: 'Errors', count: errors },
    { id: 'warning', label: 'Warnings', count: warnings },
  ];

  return (
    <section aria-labelledby="results-heading" className="results">
      <div className="results-header">
        <h2 id="results-heading">{checkLabel(result.check)} results</h2>
        <button type="button" className="ghost" aria-disabled={busy} onClick={onClear}>
          <ClearIcon />
          Clear
        </button>
      </div>

      {result.issues.length === 0 ? (
        <div className="empty">
          <CheckCircleIcon size={32} />
          <p className="empty-title">No issues found</p>
          {result.note && <p className="note">{result.note}</p>}
        </div>
      ) : (
        <>
          <div className="filters" role="group" aria-label="Show">
            {filters.map(({ id, label, count }) => (
              <button
                key={id}
                type="button"
                className={`filter ${id}`}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
                <span className="count">{count}</span>
              </button>
            ))}
          </div>
          {result.note && <p className="note">{result.note}</p>}
          {visible.length === 0 ? (
            <p className="hint">Nothing in this category.</p>
          ) : (
            <ul className="groups">
              {visible.map((group) => (
                <IssueCard key={group.key} group={group} onShow={onShow} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

const PREVIEW_COUNT = 3;

function IssueCard({ group, onShow }: { group: IssueGroup; onShow: (selector: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { severity, message, rule, fix, helpUrl, items } = group;
  const shown = expanded ? items : items.slice(0, PREVIEW_COUNT);

  return (
    <li className={`card ${severity}`}>
      <div className="card-head">
        <span className="severity-icon">{severity === 'error' ? <ErrorIcon /> : <WarningIcon />}</span>
        <div className="card-title">
          <h3>
            <span className="visually-hidden">{severity === 'error' ? 'Error: ' : 'Warning: '}</span>
            {message}
          </h3>
          <p className="meta">
            <code>{rule}</code>
            {helpUrl && (
              <a href={helpUrl} target="_blank" rel="noreferrer">
                Rule details
                <span className="visually-hidden"> for {rule} (opens in a new tab)</span>
                <ExternalIcon />
              </a>
            )}
          </p>
        </div>
        {items.length > 1 && (
          <span className="badge">
            {items.length}
            <span className="visually-hidden"> elements</span>
          </span>
        )}
      </div>

      {fix && (
        <details className="fix">
          <summary>How to fix</summary>
          <p>{fix}</p>
        </details>
      )}

      <ul className="elements">
        {shown.map((issue, index) => (
          <li key={index} className="element">
            <code className="snippet">{issue.snippet}</code>
            {issue.fix && issue.fix !== fix && <p className="element-fix">{issue.fix}</p>}
            {issue.selector && (
              <button type="button" className="show" onClick={() => onShow(issue.selector!)}>
                <TargetIcon />
                Show
                <span className="visually-hidden"> element {index + 1} on page</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {items.length > PREVIEW_COUNT && (
        <button type="button" className="more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show all ${items.length} elements`}
        </button>
      )}
    </li>
  );
}
