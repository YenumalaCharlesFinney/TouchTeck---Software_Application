import type { CanvasMode } from './Backgrounds';

/* The home look is picked on the home screen but also drives the backdrop on
   every other tab, so the list and the stored choice live here rather than
   inside Home3D. */

export type Look =
  | { id: string; label: string; hint: string; kind: 'pool'; preset: string }
  | { id: string; label: string; hint: string; kind: 'canvas'; mode: CanvasMode };

export const PRESET_KEY = 'touchteck.home3d.preset';
export const PICKER_KEY = 'touchteck.home3d.showPicker';

export const LOOKS: Look[] = [
  { id: 'calm', label: 'Pool', hint: '3D water, lane ropes and touchpads', kind: 'pool', preset: 'calm' },
  { id: 'binaryFall', label: 'Binary · Rain', hint: 'Ones raining down — the cursor lights the field and speeds the rain', kind: 'canvas', mode: 'binaryFall' },
  { id: 'scoreboard', label: 'Scoreboard', hint: 'Dot-matrix wall, raining — the cursor lights it and speeds the columns', kind: 'canvas', mode: 'scoreboard' },
];

export function getStoredLook(): Look {
  try {
    const saved = localStorage.getItem(PRESET_KEY);
    return LOOKS.find((l) => l.id === saved) ?? LOOKS[0];
  } catch {
    return LOOKS[0];
  }
}
