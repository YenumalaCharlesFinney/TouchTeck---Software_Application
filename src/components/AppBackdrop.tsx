import React, { Suspense } from 'react';
import LaneWater, { POOL_PRESETS } from './home3d/LaneWater';
import CanvasBackground from './home3d/Backgrounds';
import { getStoredLook } from './home3d/looks';

/* ============================================================
   The chosen home look, carried behind the rest of the app.

   Three rules keep it from getting in the way of running a meet:
     - the layer is `pointer-events: none`, so nothing here can ever swallow a
       click meant for the workstation;
     - it sits at the bottom of the stacking order, under every panel;
     - it renders faded and non-reactive — no cursor trail, no click ring —
       so it stays a backdrop rather than something competing for attention.

   It also runs cheaper than the home screen: the pool drops to a low pixel
   ratio here, because this is decoration on a working screen and must not
   cost frames while a race is being timed.
   ============================================================ */

export default function AppBackdrop({ dimmed = false }: { dimmed?: boolean }) {
  const look = getStoredLook();

  // On the fullscreen scoreboard the times have to carry across a hall, so the
  // backdrop runs there too but at roughly half strength.
  const className = `app-backdrop${dimmed ? ' is-dimmed' : ''}`;

  if (look.kind === 'canvas') {
    return (
      <div className={className} aria-hidden="true">
        <CanvasBackground mode={look.mode} interactive={false} />
      </div>
    );
  }

  const preset = POOL_PRESETS.find((p) => p.id === look.preset) ?? POOL_PRESETS[0];

  return (
    <div className={className} aria-hidden="true">
      <Suspense fallback={null}>
        <LaneWater preset={preset} backdrop />
      </Suspense>
    </div>
  );
}
