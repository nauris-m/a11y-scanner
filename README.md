# Web Accessibility Scanner

A Chrome extension that finds accessibility problems on the page you're looking at and highlights them in place.

## Checks

| Check | What it looks for |
| --- | --- |
| **Full scan** | All WCAG 2.x A/AA rules from [axe-core](https://github.com/dequelabs/axe-core): contrast, alt text, ARIA, headings, landmarks and more. |
| **Tab order** | Numbers every tabbable element in the order the keyboard visits it. Flags positive `tabindex` values and focusable elements with no interactive role. |
| **Forms** | Controls with no label, placeholder used as the only label, radio groups without a group label, fieldsets without a legend. |
| **Links** | Links with no text, vague text ("click here"), links that go nowhere (`#`, `javascript:`), new tabs opened without warning, repeated adjacent links. |

## Using the results

- Every finding is highlighted on the page in an overlay. The page itself is never modified.
- Findings with the same rule are grouped into one card, with a count and a list of the affected elements.
- Filter the list by **Errors** or **Warnings**.
- Open **How to fix** for guidance, or **Rule details** for the full rule documentation.
- Select **Show** next to an element to scroll to it on the page.
- **Clear** removes all highlights. Otherwise results stay in the popup until the page reloads.

Automated checks find only part of WCAG issues. Also test with a keyboard and a screen reader.

## Permissions

- `activeTab` and `scripting`: run a check on the current tab, only when you choose one in the popup.
- `storage`: keep the latest results while the tab is open (session storage, never synced).

The extension makes no network requests and has no background script. **Rule details** links open the rule's documentation on dequeuniversity.com only when you select them.

## Install

Requires Node.js 20.9+ and Chrome 105+.

```bash
git clone https://github.com/nauris-m/a11y-scanner.git
cd a11y-scanner
npm install
npm run build
```

1. Open `chrome://extensions/` and turn on **Developer mode**.
2. Select **Load unpacked** and choose the `dist` folder.
3. Pin the extension, open any page and select its icon.

Extensions can't run on browser pages such as `chrome://` or the Chrome Web Store. To scan local `file://` pages, turn on **Allow access to file URLs** in the extension's details.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development build, rebuilt on change. Reload the extension in `chrome://extensions/` afterwards. |
| `npm run build` | Production build into `dist/`. |
| `npm test` | Unit tests (Jest + jsdom). |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript type check. |
| `npm run check` | Type check, lint and tests in one go. |

### Project layout

```
src/
  manifest.json      Extension manifest (version is taken from package.json at build time)
  popup/             React popup: UI (App.tsx, icons.tsx) and chrome.* API calls (chromeApi.ts)
  page/              Runtime injected into the page (bundled to page.js)
    checks/          One file per check
    dom.ts           Selectors, visibility and accessible-name helpers
    overlay.ts       Shadow-DOM highlight layer
  shared/types.ts    Types shared by the popup and the page runtime
public/              Popup HTML/CSS and icons, copied to dist/
test/                Unit tests
```

## License

[MIT](LICENSE)
