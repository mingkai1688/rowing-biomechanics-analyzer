# Design: Configurable Drive Peak Timing

**Date:** 2026-05-03  
**Status:** Approved

## Overview

Add a "Drive Peak Timing" slider that shifts when the propulsive force peaks during the drive phase. The peak is controlled via a percentage of drive-phase progress (20–80%, default 50%). The change is physically rigorous: the peak shifts because the oar angular velocity profile changes, which flows through the blade hydrodynamics to produce a correspondingly shaped force curve.

## Affected Files

| File | Change |
|---|---|
| `src/types.ts` | Add `peakForcePercent: number` to `StrokeParams` |
| `src/services/rowingModel.ts` | Generalise `oarState()` with piecewise sine |
| `src/App.tsx` | Add default value and slider |

No other files need changes. Charts, sensitivity analysis, and the visualiser all consume `SimulationResult.propulsiveForce` and pick up the new shape automatically.

## Physics

### Current formula

`oarState()` prescribes oar angular velocity using a symmetric sinusoidal hump that always peaks at the midpoint of the drive (`u = 0.5`):

```
ω(u) = ω_avg × (r + (1−r) × (π/2) × sin(πu))
θ(u) = θ_catch + span × (r·u + (1−r) × ½(1 − cos(πu)))
```

where `u = t / driveTime ∈ [0, 1]` and `r = DRIVE_FLAT_FRAC = 0.5`.

### Generalised formula

Replace `sin(πu)` with a piecewise sine `g(u, p)` that peaks at `u = p`:

```
g(u, p) = (π/2) × sin(πu / (2p))           for u ≤ p
g(u, p) = (π/2) × sin(π(1−u) / (2(1−p)))  for u > p
```

Its exact antiderivative `G(u, p)`:

```
G(u, p) = p × (1 − cos(πu / (2p)))                  for u ≤ p
G(u, p) = p + (1−p) × cos(π(1−u) / (2(1−p)))       for u > p
```

Substituting into the kinematic equations:

```
ω(u) = ω_avg × (r + (1−r) × g(u, p))
θ(u) = θ_catch + span × (r·u + (1−r) × G(u, p))
```

### Key properties

- `∫₀¹ g(u,p) du = 1` — total angular sweep `span` is preserved regardless of `p`
- At `p = 0.5`, reduces identically to the current formula (backward compatible)
- Both derivatives of `g` equal 0 at `u = p` — C¹ continuous everywhere
- `DRIVE_FLAT_FRAC = 0.5` stays fixed — ensures ω ≥ ω_avg × 0.5 at all times, preventing near-zero blade velocity that would destabilise AoA calculations

### Signature change

```typescript
// Before
function oarState(t_cycle, T, driveTime, catchRad, finishRad)

// After
function oarState(t_cycle, T, driveTime, catchRad, finishRad, peakForcePercent)
```

`peakForcePercent` is already available in the `simulateStroke()` closure via `params`, so no further propagation is needed.

## Data Model

```typescript
// src/types.ts
export interface StrokeParams {
  catchAngle: number;
  finishAngle: number;
  strokeRate: number;
  maxHandleForce: number;
  cycles: number;
  peakForcePercent: number; // 0.2–0.8, default 0.5
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
