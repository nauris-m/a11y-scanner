import { forms } from '../src/page/checks/forms';
import { links } from '../src/page/checks/links';
import { sequentialFocusOrder, tabOrder } from '../src/page/checks/tabOrder';
import type { CheckOutput } from '../src/page/types';

const rules = (output: CheckOutput | Promise<CheckOutput>) =>
  (output as CheckOutput).findings.map((f) => `${f.rule}:${f.el.id}`);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('tab order', () => {
  it('puts positive tabindex first and skips unfocusable elements', () => {
    document.body.innerHTML = `
      <a id="a" href="/">a</a>
      <button id="b" tabindex="2">b</button>
      <input id="c">
      <button id="d" tabindex="1">d</button>
      <button id="e" disabled>e</button>
      <input id="f" type="hidden">
      <a id="g">no href</a>
      <button id="h" tabindex="-1">h</button>
      <div style="display:none"><button id="i">i</button></div>
      <fieldset disabled><input id="j"></fieldset>
      <div id="k" tabindex="0">k</div>
    `;
    expect(sequentialFocusOrder(document).map((el) => el.id)).toEqual(['d', 'b', 'a', 'c', 'k']);
  });

  it('reports positive tabindex and focusable non-interactive elements', () => {
    document.body.innerHTML = `
      <button id="a" tabindex="0">fine</button>
      <button id="b" tabindex="3">bad</button>
      <div id="c" tabindex="0">no role</div>
      <div id="d" tabindex="0" role="button">ok</div>
    `;
    expect(rules(tabOrder(document))).toEqual(['positive-tabindex:b', 'focusable-without-role:c']);
  });

  it('numbers every element in tab order', () => {
    document.body.innerHTML = '<button>1</button><a href="/">2</a>';
    const { marks } = tabOrder(document) as CheckOutput;
    expect(marks?.map((m) => m.label)).toEqual(['1', '2']);
  });
});

describe('forms', () => {
  it('reports unlabelled controls once and ignores labelled or button-type inputs', () => {
    document.body.innerHTML = `
      <label for="a">A</label><input id="a">
      <label>B <select id="b"><option>x</option></select></label>
      <input id="c" aria-label="C">
      <input id="d">
      <input id="e" placeholder="Email">
      <input id="f" type="hidden">
      <input id="g" type="submit" value="Send">
      <textarea id="h"></textarea>
      <input id="i" required aria-label="Required field">
    `;
    expect(rules(forms(document))).toEqual(['missing-label:d', 'placeholder-label:e', 'missing-label:h']);
  });

  it('requires a group label for radio groups', () => {
    document.body.innerHTML = `
      <label><input id="a1" type="radio" name="a"> Yes</label>
      <label><input id="a2" type="radio" name="a"> No</label>
      <fieldset><legend>Size</legend>
        <label><input id="b1" type="radio" name="b"> S</label>
        <label><input id="b2" type="radio" name="b"> M</label>
      </fieldset>
      <div role="radiogroup" aria-label="Colour">
        <label><input id="c1" type="radio" name="c"> Red</label>
        <label><input id="c2" type="radio" name="c"> Blue</label>
      </div>
      <fieldset id="f"><label>Solo <input></label></fieldset>
    `;
    expect(rules(forms(document))).toEqual(['radio-group-label:a1', 'fieldset-legend:f']);
  });
});

describe('links', () => {
  it('reports link problems without flagging good links', () => {
    document.body.innerHTML = `
      <a id="ok" href="/pricing">Pricing guide</a>
      <a id="img" href="/home"><img src="h.png" alt="Home"></a>
      <a id="anchor">Anchor target without href</a>
      <a id="empty" href="/x"><img src="x.png" alt=""></a>
      <a id="vague" href="/y">Read more…</a>
      <a id="js" href="javascript:void(0)">Open menu</a>
      <a id="btn" href="#" role="button">Toggle</a>
      <a id="tab" href="/z" target="_blank">Docs</a>
      <a id="tabok" href="/z2" target="_blank">Docs (opens in a new tab)</a>
      <p><a id="dup1" href="/same"><img src="s.png" alt="Same"></a><a id="dup2" href="/same">Same</a></p>
    `;
    expect(rules(links(document))).toEqual([
      'link-name:empty',
      'link-purpose:vague',
      'link-as-button:js',
      'new-tab:tab',
      'duplicate-link:dup2',
    ]);
  });
});
