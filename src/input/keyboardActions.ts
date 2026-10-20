import type { Clock } from '../core/clock';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { UiActionId } from '../core/types';

// Shortcut keys become `ui:action`s, the same events HUD buttons send, so a key and a
// settings checkbox share one path. A new shortcut (M in T5, S in T13) is one entry here.
// The debug overlay's D key stays in dev/debugOverlay.ts.

const KEY_ACTIONS: Readonly<Record<string, UiActionId>> = {
  p: 'preview.toggle',
};

/** The parts of a key press that decide whether it is a shortcut. */
export interface KeyPress {
  key: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** True while the player is typing in a text field or a select. */
  typing: boolean;
}

/** The action a key press triggers, or null. Pure. */
export function actionForKey(press: KeyPress): UiActionId | null {
  if (press.repeat || press.ctrlKey || press.metaKey || press.altKey || press.typing) return null;
  return KEY_ACTIONS[press.key.toLowerCase()] ?? null;
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Listens for shortcut keys on the window and emits their actions. */
export function startKeyboardActions(bus: EventBus<EventMap>, clock: Clock): void {
  window.addEventListener('keydown', (event) => {
    const id = actionForKey({
      key: event.key,
      repeat: event.repeat,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      typing: isTyping(event.target),
    });
    if (id) bus.emit('ui:action', { id, t: clock.now() });
  });
}
