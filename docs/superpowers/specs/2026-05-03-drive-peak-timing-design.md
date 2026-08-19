# Design: Configurable Drive Peak Timing

**Date:** 2026-05-03  
**Status:** Approved

## Overview

Add a "Drive Peak Timing" slider that shifts when the rower's handle-force input peaks during the drive phase. The peak is controlled via a percentage of drive-phase progress (20-80%, default 50%). The model then solves oar angular acceleration dynamically from handle torque and hydrodynamic blade reaction, which flows through blade kinematics to produce a correspondingly shaped propulsive-force curve.

## Affected Files

| File | Change |
|---|---|
| `src/types.ts` | Add `peakForcePercent: number` to `StrokeParams` |
| `src/services/rowingModel.ts` | Generalise the handle-force envelope with a bounded piecewise sine |
| `src/App.tsx` | Add default value and slider |

No other files need changes. Charts, sensitivity analysis, and the visualiser all consume `SimulationResult.propulsiveForce` and pick up the new shape automatically.

## Physics

### Current formula

The drive model takes handle force as input and solves oar angular acceleration:

```
α_oar = (F_handle L_in - F_N L_out) / I_oar
```

The original handle-force envelope was a symmetric sinusoidal hump that always peaked at the midpoint of the drive:

```
F_handle(u) = F_max x sin(π x (0.9u + 0.05))
```

where `u` is drive progress in `[0, 1]`. The remap to `[0.05, 0.95]` keeps the endpoint force non-zero so the oar does not stall at the catch.

### Generalised formula

Replace the symmetric sine with a bounded piecewise sine `g(u, p)` that peaks at `u = p`, where `p` is clamped to `[0.2, 0.8]`:

```
u' = 0.9u + 0.05
p' = 0.9p + 0.05
g(u', p') = sin(πu' / (2p'))                for u' ≤ p'
g(u', p') = sin(π(1-u') / (2(1-p')))        for u' > p'
```

Then:

```
F_handle(u) = F_max x phaseMultiplier x g(u', p')
```

### Key properties

- At `p = 0.5`, this reduces identically to the original symmetric envelope
- `g` is continuous and smooth at the peak, avoiding a force discontinuity
- The endpoint remap keeps force above zero at both ends, preventing catch stall in low-speed starts
- Clamping `p` to `0.2-0.8` avoids extreme force spikes and matches the UI contract

### Model change

```typescript
const p = clampPeakForcePercent(params.peakForcePercent);
const u = progress * 0.9 + 0.05;
const peak = p * 0.9 + 0.05;
const envelope = u <= peak
  ? Math.sin(Math.PI * u / (2 * peak))
  : Math.sin(Math.PI * (1 - u) / (2 * (1 - peak)));
```

## Data Model

```typescript
// src/types.ts
export interface StrokeParams {
  catchAngle: number;
  finishAngle: number;
  strokeRate: number;
  maxHandleForce: number;
  cycles: number;
  peakForcePercent: number; // 0.2-0.8, default 0.5
}
```

## UI

New slider in the Stroke Parameters panel in `src/App.tsx`, placed after the `maxHandleForce` slider:

| Property | Value |
|---|---|
| Label | Drive Peak Timing |
| Range | 20–80 (integer %) |
| Step | 5 |
| Default | 50 |
| Unit | % |
| Annotation | "Early Drive ← → Late Drive" |

Value mapping: `peakForcePercent = sliderValue / 100`.

## Behaviour by slider position

| Position | Physical meaning | Force curve shape |
|---|---|---|
| 20% | Rower maximises effort immediately at blade entry | Sharp early spike, long decay |
| 50% | Symmetric mid-drive peak (current behaviour) | Symmetric bell |
| 80% | Rower builds through the drive, peaks near the finish | Slow rise, sharp late peak |

## Out of scope

- Controlling peak sharpness (width of the bell) — single-parameter design is sufficient
- Modifying the recovery kinematics
- Changing `DRIVE_FLAT_FRAC`
