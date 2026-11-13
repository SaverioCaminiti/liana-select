// Script of the documentation site. It registers the elements from the sources
// and turns each example into a live demo with its own code shown under it.
import '../src/index';
import type { LianaSelect } from '../src/index';
import { buildChildren, menu } from '../demo/menu';

const LANGUAGE_LABELS: Record<string, string> = {
  html: 'HTML',
  js: 'JavaScript',
  css: 'CSS',
};

/** Removes the indentation shared by all lines, and blank lines at both ends. */
function dedent(text: string): string {
  const lines = text.replace(/\t/g, '  ').split('\n');
  while (lines[0]?.trim() === '') lines.shift();
  while (lines.at(-1)?.trim() === '') lines.pop();
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.length - line.trimStart().length);
  const shared = Math.min(...indents);
  return lines.map((line) => line.slice(shared)).join('\n');
}

function codeBlock(language: string, code: string): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'source';
  const caption = document.createElement('figcaption');
  caption.textContent = LANGUAGE_LABELS[language] ?? language;
  const pre = document.createElement('pre');
  pre.className = 'code';
  const codeElement = document.createElement('code');
  codeElement.textContent = code;
  pre.append(codeElement);
  figure.append(caption, pre);
  return figure;
}

/** Runs the code of an example, so that what is shown is what is running. */
function run(language: string, code: string): void {
  if (language === 'css') {
    const style = document.createElement('style');
    style.textContent = code;
    document.head.append(style);
  } else {
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = code;
    document.body.append(script);
  }
}

/** Shows the current value of a select under it. */
function addReadout(select: LianaSelect): void {
  const readout = document.createElement('p');
  readout.className = 'readout';
  const output = document.createElement('output');
  readout.append('value: ', output);
  select.after(readout);

  // The value also changes without events, when a script or a form reset sets
  // it, so the read-out is refreshed on a timer rather than on `change`.
  const refresh = (): void => {
    const text = JSON.stringify(select.value);
    if (output.textContent !== text) output.textContent = text;
  };
  refresh();
  setInterval(refresh, 200);
}

for (const select of document.querySelectorAll<LianaSelect>('liana-select[data-menu]')) {
  select.append(...buildChildren(menu));
}

for (const example of document.querySelectorAll<HTMLElement>('.example')) {
  const live = example.querySelector<HTMLElement>('.example-live');
  if (live === null) continue;

  // Read the markup before anything adds to it.
  const markup = dedent(live.innerHTML.replace(/=""/g, ''));
  const sources = Array.from(
    example.querySelectorAll<HTMLScriptElement>('script[type="text/plain"]'),
    (script) => ({
      language: script.dataset.lang ?? 'js',
      code: dedent(script.textContent),
    }),
  );

  for (const select of live.querySelectorAll<LianaSelect>('liana-select')) {
    addReadout(select);
  }

  if (!('plain' in example.dataset)) {
    const code = document.createElement('div');
    code.className = 'example-code';
    code.append(codeBlock('html', markup));
    code.append(...sources.map(({ language, code: text }) => codeBlock(language, text)));
    example.append(code);
  }

  for (const { language, code } of sources) run(language, code);
}
