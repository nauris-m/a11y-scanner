import type { CheckType, ScanResult } from '../shared/types';

export interface ActiveTab {
  id: number;
  url: string;
}

export async function getActiveTab(): Promise<ActiveTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id === undefined ? null : { id: tab.id, url: tab.url ?? '' };
}

async function hasRuntime(tabId: number): Promise<boolean> {
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__a11yScanner !== undefined,
  });
  return probe?.result === true;
}

async function ensureRuntime(tabId: number): Promise<void> {
  if (!(await hasRuntime(tabId))) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['page.js'] });
  }
}

export async function runCheck(tabId: number, check: CheckType): Promise<ScanResult> {
  await ensureRuntime(tabId);
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (type: CheckType) => window.__a11yScanner!.run(type),
    args: [check],
  });
  if (!injection?.result) throw new Error('The check did not return a result.');
  return injection.result;
}

export async function focusElement(tabId: number, selector: string): Promise<boolean> {
  await ensureRuntime(tabId);
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel: string) => window.__a11yScanner!.focus(sel),
    args: [selector],
  });
  return injection?.result === true;
}

export async function clearPage(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__a11yScanner?.clear(),
  });
}

// Results are kept per tab so they survive the popup closing.
const storageKey = (tabId: number) => `result:${tabId}`;

export async function saveResult(tabId: number, result: ScanResult): Promise<void> {
  await chrome.storage.session.set({ [storageKey(tabId)]: result });
}

export async function forgetResult(tabId: number): Promise<void> {
  await chrome.storage.session.remove(storageKey(tabId));
}

/** Returns the stored result only if the same document (and its highlights) is still loaded. */
export async function loadResult(tab: ActiveTab): Promise<ScanResult | null> {
  const key = storageKey(tab.id);
  const stored = (await chrome.storage.session.get(key))[key] as ScanResult | undefined;
  if (!stored) return null;

  const stillLoaded = stored.url === tab.url && (await hasRuntime(tab.id).catch(() => false));
  if (stillLoaded) return stored;

  await forgetResult(tab.id);
  return null;
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/cannot access|cannot be scripted|extensions gallery|chrome:\/\/|edge:\/\/|host permission/i.test(message)) {
    return (
      "This page can't be scanned. Browsers don't let extensions run on internal pages (such as chrome://) " +
      'or the extension store. For local files, turn on "Allow access to file URLs" for this extension.'
    );
  }
  return `Something went wrong: ${message}`;
}
