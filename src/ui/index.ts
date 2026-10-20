// The UI kit (T2b): import this once to load the theme, materials and component styles.
// Components are plain DOM builders; see docs/ART_DIRECTION.md and `?dev=ui`.
import './theme.css';
import './materials.css';
import './kit/parchment.css';
import './kit/seal.css';
import './kit/inkNote.css';
import './kit/frame.css';
import './kit/spellbook.css';
import './kit/grade.css';
import './kit/motion.css';

export { ensureUiFilters } from './filters';
export { gildedFrame } from './kit/gildedFrame';
export { gradeBadge } from './kit/gradeBadge';
export { inkNote, type InkNoteLevel } from './kit/inkNote';
export { parchmentPanel, type ParchmentPanelOptions } from './kit/parchmentPanel';
export { spellbookPage, type SpellbookPageOptions } from './kit/spellbookPage';
export { inkLinkButton, waxSealButton } from './kit/waxSealButton';
