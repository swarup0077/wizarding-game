import type { EventBus } from '../../core/eventBus';
import type { EventMap } from '../../core/events';
import type { UiActionId } from '../../core/types';
import { inkLinkButton, parchmentPanel, waxSealButton } from '../../ui';
import { CAMERA_INTRO, CAMERA_LABELS, type CameraCopy, cameraCopy } from './cameraCopy';
import type { Platform } from './platform';

/** What the card needs. */
export interface CameraCardOptions {
  parent: HTMLElement;
  bus: EventBus<EventMap>;
  platform: Platform;
  now: () => number;
}

/**
 * The camera card (FR-1): one parchment panel, built once, that asks for the camera and
 * explains every failure. A wax seal (Enable camera / Retry) and a quiet ink link
 * ("Use the mouse instead"). Its words are swapped in place, and it is shown or hidden with
 * opacity, so the filtered paper is painted only once (D-046).
 */
export function createCameraCard(options: CameraCardOptions): void {
  const { parent, bus, platform, now } = options;
  let primary: UiActionId = 'camera.enable';
  const act = (id: UiActionId): void => bus.emit('ui:action', { id, t: now() });

  const seal = waxSealButton(CAMERA_LABELS.enable, () => act(primary));
  const mouse = inkLinkButton(CAMERA_LABELS.useMouse, () => act('camera.useMouse'));
  // Placeholder text makes the panel build every part; real words are set per state.
  const panel = parchmentPanel({ title: ' ', body: ' ', fine: ' ', actions: [seal, mouse] });
  panel.classList.add('wg-camera-card');
  panel.setAttribute('aria-live', 'polite');
  const layer = document.createElement('div');
  layer.className = 'wg-camera-layer';
  layer.append(panel);
  parent.append(layer);

  const part = (selector: string): HTMLElement => {
    const found = panel.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`The parchment panel has no ${selector}.`);
    return found;
  };
  const title = part('.wg-parchment__title');
  const body = part('.wg-parchment__body');
  const fine = part('.wg-parchment__fine');
  const sealLabel = part('.wg-seal-button__label');

  function show(copy: CameraCopy, action: UiActionId, label: string, detail?: string): void {
    primary = action;
    title.textContent = copy.title;
    body.textContent = copy.body;
    fine.textContent = detail ?? '';
    fine.hidden = !detail;
    sealLabel.textContent = label;
    seal.hidden = !copy.retry;
    // Replay the unroll: drop the class, let style recalculate, then add it again.
    panel.classList.remove('wg-unroll');
    void panel.offsetWidth;
    panel.classList.add('wg-unroll', 'is-shown');
    panel.inert = false;
  }

  function hide(): void {
    // The unroll keeps its final frame (fill mode `both`), which would hold the card at
    // full opacity, so the animation class goes too.
    panel.classList.remove('is-shown', 'wg-unroll');
    panel.inert = true;
  }

  hide();
  bus.on('camera:status', (status) => {
    if (status.state === 'idle') show(CAMERA_INTRO, 'camera.enable', CAMERA_LABELS.enable);
    else if (status.state === 'failed' && status.failure)
      show(
        cameraCopy(status.failure, platform),
        'camera.retry',
        CAMERA_LABELS.retry,
        status.detail,
      );
    else hide();
  });
}
