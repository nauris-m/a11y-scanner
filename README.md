# Web Accessibility Scanner

A Chrome extension that finds accessibility problems on the page you're looking at and highlights them in place.

## Checks

| Check | What it looks for |
| --- | --- |
| **Full scan** | All WCAG 2.x A/AA rules from [axe-core](https://github.com/dequelabs/axe-core): contrast, alt text, ARIA, headings, landmarks and more. |
| **Tab order** | Numbers every tabbable element in the order the keyboard visits it. Flags positive `tabindex` values and focusable elements with no interactive role. |
| **Forms** | Controls with no label, placeholder used as the only label, radio groups without a group label, fieldsets without a legend. |
| **Links** | Links with no text, vague text ("click here"), links that go nowhere (`#`, `javascript:`), new tabs opened without warning, repeated adjacent links. |

Each finding is drawn on the page in an overlay. Select **Show on page** in the popup to scroll to it. The page itself is never modified, and **Clear highlights** removes everything. Results stay in the popup until you clear them or the page reloads.

Automated checks find only part of WCAG issues. Also test with a keyboard and a screen reader.

## Permissions

- `activeTab` and `scripting`: run the checks on the current tab, only when you open the popup.
- `storage`: keep the latest results while the tab is open (session storage, never synced).

The extension makes no network requests and has no background script.

## Install

Requires Node.js 18+ and Chrome 105+.

```bash
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
| `npm run check` | All of the above except the build. |

### Project layout

```
src/
  manifest.json      Extension manifest (version is taken from package.json at build time)
  popup/             React popup: UI and calls to chrome.* APIs
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
