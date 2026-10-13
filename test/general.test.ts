import { general } from '../src/page/checks/general';

// jsdom has no canvas; axe only uses it for icon-ligature detection.
beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

it('reports axe-core violations with element references', async () => {
  document.documentElement.lang = 'en';
  document.title = 'Test';
  document.body.innerHTML = '<main><h1>Title</h1><img id="pic" src="x.png"></main>';

  const { findings } = await general(document);
  const imageAlt = findings.find((f) => f.rule === 'image-alt');

  expect(imageAlt?.el.id).toBe('pic');
  expect(imageAlt?.severity).toBe('error');
  expect(imageAlt?.helpUrl).toMatch(/^https:\/\/dequeuniversity\.com\//);
});
