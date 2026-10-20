// The shape of the persisted settings (FR-22). It lives in core so the `settings:changed`
// event can carry it; loading, validation and saving are in settings/settings.ts.

/** Speech recognition languages offered in settings. */
export type VoiceLang = 'en-US' | 'en-IN';

/**
 * Webcam preview frame styles. Each name is one `.wg-frame--<name>` block in
 * src/ui/kit/frame.css; adding a style means adding that block and its name here.
 * The first entry is the default. The final choice waits for Phase 1/2 (docs/LATER.md).
 */
export const PREVIEW_FRAMES = ['minimal', 'portrait'] as const;

/** A webcam preview frame style. */
export type PreviewFrame = (typeof PREVIEW_FRAMES)[number];

/** Everything the settings panel controls. */
export interface Settings {
  voiceLang: VoiceLang;
  /** Off = gesture-only mode. */
  voiceRequired: boolean;
  inputMode: 'hand' | 'mouse';
  wandHand: 'any' | 'left' | 'right';
  /** Faint guide shape on the stage while tracing. */
  guideShapes: boolean;
  /** 0 (silent) to 1. */
  masterVolume: number;
  /** Dev: active gesture recognizer. */
  recognizer: 'protractor' | 'dollarOne';
  /** Dev: default + personal templates, or personal only. */
  templateMode: 'all' | 'mineOnly';
  /** The webcam preview's frame style. */
  previewFrame: PreviewFrame;
  /** Whether the webcam picture is shown (P). Hiding it never stops the camera or tracking. */
  showPreview: boolean;
}
