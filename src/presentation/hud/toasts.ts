import { HUD } from '../../config/tuning';
import type { EventBus } from '../../core/eventBus';
import type { EventMap } from '../../core/events';
import { inkLinkButton, inkNote } from '../../ui';
import { createToastQueue, type Toast } from './toastQueue';

/** One reusable ink-note slot. */
interface Slot {
  note: HTMLElement;
  words: HTMLElement;
  toastId: number | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Toasts (FR-20): `system:message` shown as ink notes, bottom centre. The slots are built
 * once and refilled, never recreated (D-046). A toast's action emits `ui:action`.
 */
export function createToasts(
  parent: HTMLElement,
  bus: EventBus<EventMap>,
  now: () => number,
): void {
  const queue = createToastQueue({ max: HUD.toastMax, lifetimeMs: HUD.toastMs });
  const stack = document.createElement('div');
  stack.className = 'wg-toasts';
  parent.append(stack);

  const slots: Slot[] = Array.from({ length: HUD.toastMax }, () => {
    const note = inkNote(' ', 'info');
    note.classList.add('wg-toast');
    stack.append(note);
    const words = note.querySelector<HTMLElement>('.wg-ink-note__text') ?? note;
    return { note, words, toastId: null, timer: null };
  });

  const slotOf = (id: number): Slot | undefined => slots.find((s) => s.toastId === id);

  function clear(slot: Slot): void {
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = null;
    slot.toastId = null;
    slot.note.classList.remove('is-shown');
  }

  function expireLater(slot: Slot, toast: Toast): void {
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = setTimeout(() => {
      queue.remove(toast.id);
      clear(slot);
    }, toast.lifetimeMs);
  }

  function fill(slot: Slot, toast: Toast): void {
    slot.toastId = toast.id;
    const { note, words } = slot;
    note.className = `wg-ink-note wg-ink-note--${toast.level} wg-toast`;
    note.setAttribute('role', toast.level === 'error' ? 'alert' : 'status');
    note.style.order = String(toast.id); // oldest on top, whatever the slot
    words.textContent = toast.text;
    words.dataset['text'] = toast.text;
    const action = toast.action;
    if (action) {
      const link = inkLinkButton(action.label, () =>
        bus.emit('ui:action', { id: action.id, t: now() }),
      );
      link.classList.add('wg-ink-note__action');
      words.append(link);
    }
    void note.offsetWidth; // restart the ink-bleed entrance
    note.classList.add('wg-ink-in', 'is-shown');
  }

  bus.on('system:message', (message) => {
    const { toast, evicted, refreshed } = queue.push(message);
    if (evicted) {
      const old = slotOf(evicted.id);
      if (old) clear(old);
    }
    const slot = refreshed ? slotOf(toast.id) : slots.find((s) => s.toastId === null);
    if (!slot) return;
    if (!refreshed) fill(slot, toast);
    expireLater(slot, toast);
  });
}
