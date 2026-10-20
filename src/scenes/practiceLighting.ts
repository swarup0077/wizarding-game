import { STAGE_LOOK } from '../config/tuning';
import type { View } from '../presentation/view';

const MOONLIGHT_RGB = '125, 155, 255';
const VIGNETTE_RGB = '1, 2, 8';
const DEG = Math.PI / 180;

/**
 * Lights the finished wall: a soft, cool moonlight shaft from the upper left,
 * an overall dimming (D-017), and a deep vignette that sinks the corners.
 */
export function drawPracticeLighting(g: CanvasRenderingContext2D, view: View): void {
  drawMoonShaft(g, view);

  const { width: w, height: h } = view;
  g.fillStyle = `rgba(0, 0, 0, ${STAGE_LOOK.dimAlpha})`;
  g.fillRect(0, 0, w, h);

  const halfDiagonal = Math.hypot(w, h) / 2;
  const vignette = g.createRadialGradient(
    w / 2,
    h / 2,
    halfDiagonal * STAGE_LOOK.vignetteInner,
    w / 2,
    h / 2,
    halfDiagonal * STAGE_LOOK.vignetteOuter,
  );
  vignette.addColorStop(0, `rgba(${VIGNETTE_RGB}, 0)`);
  vignette.addColorStop(0.6, `rgba(${VIGNETTE_RGB}, ${STAGE_LOOK.vignetteAlpha * 0.55})`);
  vignette.addColorStop(1, `rgba(${VIGNETTE_RGB}, ${STAGE_LOOK.vignetteAlpha})`);
  g.fillStyle = vignette;
  g.fillRect(0, 0, w, h);
}

/**
 * The shaft is a band of light built in its own small canvas: one gradient across its
 * width gives soft edges, a second along its length (applied with 'destination-in',
 * which multiplies alpha) makes it fade as it crosses the wall. The band is then
 * rotated into place and added onto the wall.
 */
function drawMoonShaft(g: CanvasRenderingContext2D, view: View): void {
  const length = Math.ceil(view.lengthToPx(STAGE_LOOK.shaftLength));
  const width = Math.ceil(view.lengthToPx(STAGE_LOOK.shaftWidth));
  const beam = document.createElement('canvas');
  beam.width = length;
  beam.height = width;
  const b = beam.getContext('2d');
  if (!b) return;

  const across = b.createLinearGradient(0, 0, 0, width);
  across.addColorStop(0, `rgba(${MOONLIGHT_RGB}, 0)`);
  across.addColorStop(0.5, `rgba(${MOONLIGHT_RGB}, ${STAGE_LOOK.shaftAlpha})`);
  across.addColorStop(1, `rgba(${MOONLIGHT_RGB}, 0)`);
  b.fillStyle = across;
  b.fillRect(0, 0, length, width);

  const along = b.createLinearGradient(0, 0, length, 0);
  along.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  along.addColorStop(0.2, 'rgba(0, 0, 0, 1)');
  along.addColorStop(1, 'rgba(0, 0, 0, 0)');
  b.globalCompositeOperation = 'destination-in';
  b.fillStyle = along;
  b.fillRect(0, 0, length, width);

  g.save();
  g.translate(view.lengthToPx(STAGE_LOOK.shaftOriginX), view.lengthToPx(STAGE_LOOK.shaftOriginY));
  g.rotate(STAGE_LOOK.shaftAngleDeg * DEG);
  g.globalCompositeOperation = 'lighter';
  g.drawImage(beam, 0, -width / 2);
  g.restore();
}
