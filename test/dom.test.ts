import { accessibleName, isRendered, snippet, uniqueSelector } from '../src/page/dom';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('uniqueSelector', () => {
  it('matches exactly the original element', () => {
    document.body.innerHTML = `
      <ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul>
      <div id="dup"><span>1</span></div><div id="dup"><span>2</span></div>
      <p id="weird:id &quot;x&quot;"><em>x</em></p>
      <p id="1st"><b>y</b></p>
      <div class="a  b"><i>z</i></div>
    `;
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      expect(document.querySelector(uniqueSelector(el))).toBe(el);
    }
  });
});

describe('accessibleName', () => {
  it.each([
    ['<label for="x">Email</label><input id="x">', 'input', 'Email'],
    ['<label>Name <input></label>', 'input', 'Name'],
    ['<span id="l">Search</span><input aria-labelledby="l">', 'input', 'Search'],
    ['<input aria-label="  Phone ">', 'input', 'Phone'],
    ['<input placeholder="Only placeholder">', 'input', ''],
    ['<a href="/"><img src="x.png" alt="Home"></a>', 'a', 'Home'],
    ['<a href="/"><svg aria-hidden="true"></svg></a>', 'a', ''],
    ['<a href="/" title="Profile"><svg aria-hidden="true"></svg></a>', 'a', 'Profile'],
    ['<button>  Save <span aria-hidden="true">💾</span></button>', 'button', 'Save'],
  ])('%s', (html, selector, expected) => {
    document.body.innerHTML = html;
    expect(accessibleName(document.querySelector(selector)!)).toBe(expected);
  });
});

describe('isRendered', () => {
  it('treats elements inside hidden ancestors as not rendered', () => {
    document.body.innerHTML = `
      <div style="display:none"><a id="a" href="/">a</a></div>
      <div hidden><a id="b" href="/">b</a></div>
      <a id="c" href="/" style="visibility:hidden">c</a>
      <a id="d" href="/">d</a>
    `;
    expect(['a', 'b', 'c', 'd'].map((id) => isRendered(document.getElementById(id)!))).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });
});

describe('snippet', () => {
  it('truncates long markup', () => {
    document.body.innerHTML = `<p>${'x'.repeat(500)}</p>`;
    const text = snippet(document.querySelector('p')!);
    expect(text).toHaveLength(200);
    expect(text.endsWith('…')).toBe(true);
  });
});
