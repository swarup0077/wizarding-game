// Dev page (?dev=ui): every UI kit component in each of its states, over the real stage.
// Loaded only when asked for. Hover and pressed states are shown statically with
// `is-hover` / `is-pressed`, so screenshots can show them.
import { PREVIEW_FRAMES } from '../core/settingsTypes';
import { contrastRatio } from '../ui/contrast';
import { GAME_TITLE } from '../ui/brand';
import { GRADE_WORDS, type Grade } from '../ui/grades';
import {
  ensureUiFilters,
  gradeBadge,
  inkLinkButton,
  inkNote,
  parchmentPanel,
  pictureFrame,
  spellbookPage,
  statusTag,
  waxSealButton,
} from '../ui';
import { readTokens, resolveToken } from '../ui/themeTokens';
import themeCss from '../ui/theme.css?raw';
import { demoShapes } from './demoShapes';
import './uiGallery.css';

const noop = (): void => undefined;

const SWATCHES = [
  ['--night-900', '--night-700', '--parchment-100', '--parchment-300', '--parchment-edge'],
  ['--ink-900', '--ink-700', '--ink-green', '--ink-red', '--gold-400', '--gold-800'],
  ['--wax-500', '--grade-o', '--grade-e', '--grade-a', '--grade-p'],
  ['--spell-lumos', '--spell-leviosa', '--spell-incendio'],
  ['--house-scarlet', '--house-scarlet-gold', '--house-green', '--house-green-silver'],
  ['--house-blue', '--house-blue-bronze', '--house-yellow', '--house-yellow-black'],
];

/** Builds the gallery inside `parent`. */
export function mountUiGallery(parent: HTMLElement): void {
  ensureUiFilters();
  const page = section('wg-gallery wg-on-night', '');
  page.append(heading(`UI kit · ${GAME_TITLE}`, 'h1'));
  page.append(
    note('Every component in each state. Text colours are contrast-checked in tests.'),
    replayButton(page),
    paletteSection(),
    typeSection(),
    panelsSection(),
    buttonsSection(),
    notesSection(),
    frameAndGradesSection(),
    spellbookSection(),
  );
  parent.append(page);
}

function section(className: string, title: string): HTMLElement {
  const s = document.createElement('section');
  s.className = className;
  if (title) s.append(heading(title, 'h2'));
  return s;
}

function heading(text: string, tag: 'h1' | 'h2' | 'h3'): HTMLElement {
  const h = document.createElement(tag);
  h.className = 'wg-gallery__heading';
  h.textContent = text;
  return h;
}

function note(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'wg-gallery__note';
  p.textContent = text;
  return p;
}

function row(...children: HTMLElement[]): HTMLElement {
  const r = document.createElement('div');
  r.className = 'wg-gallery__row';
  r.append(...children);
  return r;
}

function labelled(label: string, child: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'wg-gallery__item';
  wrap.append(child, note(label));
  return wrap;
}

function replayButton(page: HTMLElement): HTMLElement {
  return waxSealButton(
    'Replay entrances',
    () => {
      for (const el of page.querySelectorAll<HTMLElement>('.wg-unroll, .wg-ink-in')) {
        const classes = ['wg-unroll', 'wg-ink-in'].filter((c) => el.classList.contains(c));
        el.classList.remove(...classes);
        void el.offsetWidth; // restart the CSS animation
        el.classList.add(...classes);
      }
    },
    'star',
  );
}

function paletteSection(): HTMLElement {
  const s = section('wg-gallery__section', 'Palette');
  const tokens = readTokens(themeCss);
  const parchment = resolveToken(tokens, '--parchment-100') ?? '#fff';
  for (const names of SWATCHES) {
    const r = row();
    for (const name of names) {
      const value = resolveToken(tokens, name) ?? '?';
      const chip = document.createElement('div');
      chip.className = 'wg-gallery__swatch';
      chip.style.background = value;
      const ratio = value.startsWith('#') ? contrastRatio(value, parchment).toFixed(1) : '–';
      r.append(labelled(`${name} ${value} · ${ratio}:1 on parchment`, chip));
    }
    s.append(r);
  }
  return s;
}

function typeSection(): HTMLElement {
  const s = section('wg-gallery__section', 'Type');
  const specimen = parchmentPanel({});
  const lines: [string, string, string][] = [
    ['Cinzel Decorative · titles, spell names', 'wg-gallery__type-title', 'Wingardium Leviosa'],
    [
      'Cinzel Decorative · labels, buttons (uppercase)',
      'wg-gallery__type-label',
      'Retry · Use the mouse · Settings',
    ],
    [
      'IM Fell English · body',
      'wg-gallery__type-body',
      'Hold the wand steady, then trace the shape in one smooth stroke while you say the word.',
    ],
    [
      'IM Fell English italic · hints',
      'wg-gallery__type-italic',
      'Shape unclear: try a rounder circle.',
    ],
    ['Pinyon Script · handwriting (green ink)', 'wg-gallery__type-hand', 'To the Wand-Bearer'],
  ];
  for (const [label, className, sample] of lines) {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = sample;
    specimen.append(note(label), p);
  }
  s.append(specimen);
  return s;
}

function panelsSection(): HTMLElement {
  const s = section('wg-gallery__section', 'Parchment panel and the acceptance letter');
  const message = parchmentPanel({
    title: 'Your Mac is blocking the camera',
    body: 'Open System Settings → Privacy & Security → Camera, turn on Google Chrome, then quit and reopen Chrome.',
    fine: 'NotAllowedError: Permission denied by system',
    actions: [waxSealButton('Retry', noop), inkLinkButton('Use the mouse instead', noop)],
    animate: true,
  });
  message.classList.add('wg-gallery__panel');
  s.append(
    row(labelled('Camera message (T3)', message), labelled('Acceptance letter (T13)', letter())),
  );
  return s;
}

/** A mock of the T13 letter: original wording, the address in green handwriting. */
function letter(): HTMLElement {
  const panel = parchmentPanel({ animate: true });
  panel.classList.add('wg-gallery__letter');
  const address = document.createElement('p');
  address.className = 'wg-gallery__address';
  address.textContent =
    'To the Wand-Bearer\nThe Chair by the Glowing Window\nThe Room with the Watching Lens';
  const seal = waxSealButton('Break the seal', noop, 'star');
  seal.classList.add('wg-gallery__letter-seal');
  panel.append(address, seal);
  return panel;
}

function buttonsSection(): HTMLElement {
  const s = section('wg-gallery__section', 'Wax-seal buttons');
  const state = (label: string, cls: string, mark: 'wand' | 'star' = 'wand'): HTMLElement => {
    const b = waxSealButton('Retry', noop, mark);
    if (cls) b.classList.add(cls);
    return labelled(label, b);
  };
  const disabled = waxSealButton('Retry', noop);
  disabled.disabled = true;
  const onParchment = parchmentPanel({});
  onParchment.append(
    row(
      state('normal', ''),
      state('hover', 'is-hover'),
      state('pressed', 'is-pressed'),
      labelled('disabled', disabled),
      state('star mark', '', 'star'),
    ),
    row(
      labelled('ink link', inkLinkButton('Use the mouse instead', noop)),
      labelled(
        'ink link, hover',
        withClass(inkLinkButton('Use the mouse instead', noop), 'is-hover'),
      ),
    ),
  );
  const onNight = document.createElement('div');
  onNight.className = 'wg-on-night wg-gallery__night';
  onNight.append(
    row(
      labelled('on the night stage', waxSealButton('Enable camera', noop)),
      labelled('ink link', inkLinkButton('Not now', noop)),
    ),
  );
  s.append(onParchment, onNight);
  return s;
}

function withClass<T extends HTMLElement>(el: T, cls: string): T {
  el.classList.add(cls);
  return el;
}

function notesSection(): HTMLElement {
  const s = section('wg-gallery__section', 'Ink-note toasts');
  s.append(
    row(
      labelled('info', inkNote('Camera connected.', 'info')),
      labelled(
        'warn',
        inkNote('Tracking is slow: add light, keep your hand 40–80 cm away.', 'warn'),
      ),
      labelled(
        'error, with action',
        inkNote(
          'The camera disconnected. Using the mouse for now.',
          'error',
          inkLinkButton('Retry', noop),
        ),
      ),
    ),
  );
  return s;
}

function frameAndGradesSection(): HTMLElement {
  const s = section('wg-gallery__section', 'Preview frames, status tags and grade badges');
  // Every frame style in PREVIEW_FRAMES, so a new CSS style shows up here by itself.
  const frames = PREVIEW_FRAMES.map((style) => {
    const placeholder = document.createElement('div');
    placeholder.className = 'wg-frame__placeholder';
    const frame = pictureFrame(placeholder, { style, plate: 'Your wand hand' });
    frame.classList.add('wg-gallery__frame');
    return labelled(`preview frame: ${style}`, frame);
  });
  const tags = row(
    labelled('status tag, quiet', statusTag('Camera on · hand seen')),
    labelled('status tag, alert', statusTag('Camera on · hand lost', 'alert')),
  );
  const grades = row(
    ...(['O', 'E', 'A', 'P'] as Grade[]).map((g) =>
      labelled(`${g}: ${GRADE_WORDS[g]}`, gradeBadge(g)),
    ),
  );
  s.append(row(...frames), tags, grades);
  return s;
}

function spellbookSection(): HTMLElement {
  const s = section('wg-gallery__section', 'Spellbook pages');
  const byName = (name: string) => demoShapes.find((d) => d.name === name)?.points ?? [];
  s.append(
    row(
      spellbookPage({
        spellId: 'lumos',
        name: 'Lumos',
        pronunciation: 'LOO-mos',
        shape: byName('circle'),
        hint: 'Start at the dot; one clockwise circle.',
        animate: true,
      }),
      spellbookPage({
        spellId: 'leviosa',
        name: 'Wingardium Leviosa',
        pronunciation: 'win-GAR-dee-um lev-ee-OH-sa',
        shape: byName('swish'),
        hint: 'Swish down and up, then flick.',
        animate: true,
      }),
      spellbookPage({
        spellId: 'incendio',
        name: 'Incendio',
        pronunciation: 'in-SEN-dee-oh',
        shape: byName('zigzag'),
        hint: 'Zigzag upward like a flame.',
        animate: true,
      }),
    ),
  );
  return s;
}
