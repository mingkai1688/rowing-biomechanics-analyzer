import { RowerAnatomy, BoatSetup, StrokeParams, SimulationResult, SensitivityResult } from '../types';

const RHO = 1000; // Water density kg/m^3
const BLADE_AREA = 0.12; // m^2 (Smoothie/Macon style)
const BOAT_MASS = 14; // kg (Single scull)
const ROWER_MASS = 85; // kg
const ADDED_MASS = 10; // kg (Entrained water virtual mass)
const I_OAR = 25; // kg m^2 (Effective oar moment of inertia, including water added mass)
const BASE_SLIDE_LENGTH = 0.7; // m (Seat slide length for baseline anatomy)
const MIN_PEAK_FORCE_PERCENT = 0.2;
const MAX_PEAK_FORCE_PERCENT = 0.8;
export const MAX_SEAT_ACCEL = 15; // m/s^2, bounds the physiologically plausible seat return

function clampPeakForcePercent(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(MAX_PEAK_FORCE_PERCENT, Math.max(MIN_PEAK_FORCE_PERCENT, value));
}

export function estimateSlideLength(anatomy: RowerAnatomy): number {
  const legContribution = (anatomy.legLength - 0.95) * 0.45;
  const trunkContribution = (anatomy.trunkLength - 0.65) * 0.18;
  const armContribution = (anatomy.armLength - 0.75) * 0.12;
  const slideLength = BASE_SLIDE_LENGTH + legContribution + trunkContribution + armContribution;

  return Math.min(0.85, Math.max(0.55, slideLength));
}

export function simulateStroke(
  anatomy: RowerAnatomy,
  setup: BoatSetup,
  params: StrokeParams,
  forceMultiplier: { catch: number, mid: number, finish: number } = { catch: 1, mid: 1, finish: 1 }
): SimulationResult[] {
  const results: SimulationResult[] = [];
  const T = 60 / params.strokeRate;
  const dt = 0.002;
  // Down-sample integrator output to a ~10ms cadence for charts/animation.
  // At dt=0.002s, every 5 steps = 10ms; this matches the cadence the UI was tuned for.
  const SAMPLE_EVERY_N_STEPS = 5;

  const catchRad = (params.catchAngle * Math.PI) / 180;
  const finishRad = (params.finishAngle * Math.PI) / 180;
  const totalAngle = catchRad - finishRad;
  const slideLength = estimateSlideLength(anatomy);

  let vb = 0; // Start from rest
  let t_global = 0;

  for (let cycle = 0; cycle < params.cycles; cycle++) {
    let theta = catchRad;
    let omega = 0;
    let t_cycle = 0;
    let driveStep = 0;

    // 1. DRIVE PHASE (Dynamic Integration)
    const driveResults: SimulationResult[] = [];
    // We integrate until the oar angle reaches the finish angle, preserving geometric constraints.
    // The 5s cap is what actually bounds an underpowered stroke. When the rower cannot overcome
    // blade reaction the oar creeps forward rather than reversing, so the loop needs a time bound
    // and not only an angular one: omega starts at zero with positive angular acceleration (the
    // force envelope is never zero at the catch), and any later excess of blade reaction over
    // handle torque slows the oar, which cuts blade speed, which cuts F_norm, pushing the
    // acceleration back toward zero. That negative feedback keeps omega above zero.
    // An `omega < 0` break used to sit here to stop theta drifting back toward the catch. It never
    // fired anywhere in the slider ranges, so it was removed; the invariant it claimed to protect
    // is pinned by tests instead. Drives that exit here short of finishRad hand off to recovery
    // from their actual terminal state (see driveEndTheta below).
    while (theta > finishRad && t_cycle < 5.0) {
      const progress = (catchRad - theta) / totalAngle;
      
      let phaseMul = 1;
      let phase: SimulationResult['phase'] = 'Catch';
      if (progress < 0.33) { phase = 'Catch'; phaseMul = forceMultiplier.catch; }
      else if (progress < 0.66) { phase = 'Mid-Drive'; phaseMul = forceMultiplier.mid; }
      else { phase = 'Finish'; phaseMul = forceMultiplier.finish; }

      // Piecewise sine envelope peaking at peakForcePercent through the drive.
      // Progress is rescaled to [0.05, 0.95] so the envelope is ~15% at both
      // endpoints (matching original behaviour) and never zero, which prevents
      // the oar stalling at the catch. At p=0.5 this is identical to the
      // original sin(π*(progress*0.9+0.05)) formula.
      const p = clampPeakForcePercent(params.peakForcePercent);
      const u = progress * 0.9 + 0.05;          // [0.05 … 0.95]
      const peak = p * 0.9 + 0.05;              // peak in rescaled space
      const envelope = u <= peak
        ? Math.sin(Math.PI * u / (2 * peak))
        : Math.sin(Math.PI * (1 - u) / (2 * (1 - peak)));
      const F_handle = params.maxHandleForce * phaseMul * envelope;
      
      // Blade Kinematics
      const U_norm = -vb * Math.cos(theta) + setup.outboard * omega;
      const U_chord = -vb * Math.sin(theta);
      const V = Math.sqrt(U_norm * U_norm + U_chord * U_chord);
      const alpha = V === 0 ? 0 : Math.atan2(Math.abs(U_norm), Math.abs(U_chord));
      
      // Hydrodynamic Coefficients (Caplan & Gardner approximations)
      const C_N = 1.5 * Math.sin(alpha);
      const C_T = 0.1 * Math.cos(alpha);
      
      // Hydrodynamic Forces
      const F_norm = 0.5 * RHO * BLADE_AREA * V * V * C_N * Math.sign(U_norm);
      const F_tang = 0.5 * RHO * BLADE_AREA * V * V * C_T * Math.sign(U_chord);
      const F_wx = F_norm * Math.cos(theta) - Math.abs(F_tang) * Math.sin(theta);
      
      // Oar rotational acceleration (solves handle velocity rather than prescribing it)
      const domega = (F_handle * setup.inboard - F_norm * setup.outboard) / I_OAR;
      
      // Rower internal inertial force (a_r is acceleration of rower relative to boat)
      const ar = slideLength * (domega / totalAngle);
      
      // Advanced Hull Drag: Skin friction (v^1.85) + Wave making (v^4)
      const vb_abs = Math.abs(vb);
      const hullDrag = (2.5 * Math.pow(vb_abs, 1.85) + 0.05 * Math.pow(vb_abs, 4)) * Math.sign(vb);
      
      // Coupled Two-Body System Acceleration
      const netForce = 2 * F_wx - hullDrag - ROWER_MASS * ar;
      const dvb = netForce / (BOAT_MASS + ROWER_MASS + ADDED_MASS);
      
      const seatPosition = slideLength * (catchRad - theta) / totalAngle;

      if (driveStep % SAMPLE_EVERY_N_STEPS === 0) {
        driveResults.push({
          time: t_global,
          oarAngle: (theta * 180) / Math.PI,
          handleVelocity: omega * setup.inboard,
          bladeVelocity: omega * setup.outboard,
          propulsiveForce: 2 * F_wx,
          liftForce: F_norm,
          dragForce: Math.abs(F_tang),
          hullDrag: hullDrag,
          netForce: netForce,
          slip: U_norm,
          boatVelocity: vb,
          seatPosition,
          phase
        });
      }

      omega += domega * dt;
      theta -= omega * dt; // theta decreases during drive (bow towards stern)
      vb += dvb * dt;
      t_cycle += dt;
      t_global += dt;
      driveStep += 1;
    }

    const driveTime = t_cycle;
    // For the cubic seat-velocity profile, peak acceleration is approximately
    // 6*L/Tr^2, so Tr >= sqrt(6*L/a_max). A fixed 0.1s floor let the same slide
    // distance demand extreme, non-physiological acceleration and inertial force.
    const minRecoveryTime = Math.sqrt(6 * slideLength / MAX_SEAT_ACCEL);
    const recoveryTime = Math.max(minRecoveryTime, T - driveTime);

    // The drive does not always reach finishRad: it exits on the 5s safety cap when the
    // rower cannot overcome blade reaction within that budget. Recovery
    // must therefore start from wherever the oar and seat actually ended up, otherwise
    // an underpowered stroke teleports the oar to the finish and the seat to full slide
    // in a single step, and fabricates recovery accelerations for travel that never
    // happened. On a completed drive theta === finishRad and these reduce to the
    // previous fixed values.
    const driveEndTheta = theta;
    const driveEndSeat = slideLength * (catchRad - driveEndTheta) / totalAngle;
    const recoverySweep = catchRad - driveEndTheta;

    // To strictly conserve momentum across the stroke cycle, the integral of seat acceleration (ar)
    // over the recovery must precisely cancel the accumulated seat velocity from the drive phase,
    // while also returning the seat to the catch position (integral of v_r over recovery = -driveEndSeat).
    const v_r_finish = slideLength * omega / totalAngle;
    const A = v_r_finish;
    const B = (-6 * driveEndSeat - 4 * v_r_finish * recoveryTime) / (recoveryTime * recoveryTime);
    const C = (3 * v_r_finish + 6 * driveEndSeat / recoveryTime) / (recoveryTime * recoveryTime);

    // 2. RECOVERY PHASE (Kinematic Return)
    const recResults: SimulationResult[] = [];
    let recoveryStep = 0;
    for (let t_rec = 0; t_rec < recoveryTime; t_rec += dt) {
      const phi = Math.PI * (t_rec / recoveryTime);
      
      // Momentum-conserving seat acceleration (derivative of parabolic velocity profile)
      const ar = B + 2 * C * t_rec;
      
      const vb_abs = Math.abs(vb);
      const hullDrag = (2.5 * Math.pow(vb_abs, 1.85) + 0.05 * Math.pow(vb_abs, 4)) * Math.sign(vb);
      
      // Positive surge early recovery, negative 'check' late recovery
      const netForce = -hullDrag - ROWER_MASS * ar; 
      const dvb = netForce / (BOAT_MASS + ROWER_MASS + ADDED_MASS);
      
      const currentTheta = driveEndTheta + recoverySweep * 0.5 * (1 - Math.cos(phi));
      const currentOmega = -(recoverySweep / 2) * (Math.PI / recoveryTime) * Math.sin(phi);

      const seatPosition = driveEndSeat + A * t_rec + 0.5 * B * t_rec * t_rec + (C / 3) * t_rec * t_rec * t_rec;

      if (recoveryStep % SAMPLE_EVERY_N_STEPS === 0) {
        recResults.push({
          time: t_global,
          oarAngle: (currentTheta * 180) / Math.PI,
          handleVelocity: currentOmega * setup.inboard,
          bladeVelocity: currentOmega * setup.outboard,
          propulsiveForce: 0,
          liftForce: 0,
          dragForce: 0,
          hullDrag: hullDrag,
          netForce: netForce,
          slip: -vb * Math.cos(currentTheta), // Rough slip estimate out of water
          boatVelocity: vb,
          seatPosition,
          phase: 'Recovery'
        });
      }

      vb += dvb * dt;
      t_global += dt;
      recoveryStep += 1;
    }

    results.push(...driveResults, ...recResults);
  }

  return results;
}

export function getLastCycleResults(results: SimulationResult[]): SimulationResult[] {
  let lastCycleStartIndex = 0;

  for (let i = 1; i < results.length; i += 1) {
    if (results[i - 1].phase === 'Recovery' && results[i].phase !== 'Recovery') {
      lastCycleStartIndex = i;
    }
  }

  return results.slice(lastCycleStartIndex);
}

export function getAverageBoatSpeed(results: SimulationResult[]): number {
  const lastCycle = getLastCycleResults(results);
  if (lastCycle.length === 0) return 0;
  return lastCycle.reduce((sum, result) => sum + result.boatVelocity, 0) / lastCycle.length;
}

export function getAchievedStrokeRate(results: SimulationResult[]): number {
  const cycleStarts = results
    .filter((result, index) => index === 0 || (results[index - 1].phase === 'Recovery' && result.phase !== 'Recovery'))
    .map((result) => result.time);

  if (cycleStarts.length < 2) return 0;
  const meanCycleDuration = (cycleStarts.at(-1)! - cycleStarts[0]) / (cycleStarts.length - 1);
  return meanCycleDuration > 0 ? 60 / meanCycleDuration : 0;
}

export function calculateSensitivity(
  results: SimulationResult[], 
  anatomy: RowerAnatomy, 
  setup: BoatSetup, 
  params: StrokeParams
): SensitivityResult[] {
  const baseSpeed = getAverageBoatSpeed(results);

  // Perturbation runs (+5% force in specific phases)
  const resCatch = simulateStroke(anatomy, setup, params, { catch: 1.05, mid: 1.0, finish: 1.0 });
  const resMid = simulateStroke(anatomy, setup, params, { catch: 1.0, mid: 1.05, finish: 1.0 });
  const resFinish = simulateStroke(anatomy, setup, params, { catch: 1.0, mid: 1.0, finish: 1.05 });

  const sCatch = Math.max(0, getAverageBoatSpeed(resCatch) - baseSpeed);
  const sMid = Math.max(0, getAverageBoatSpeed(resMid) - baseSpeed);
  const sFinish = Math.max(0, getAverageBoatSpeed(resFinish) - baseSpeed);
  
  const totalS = sCatch + sMid + sFinish + 0.0001; // Avoid div zero

  return [
    {
      phase: 'Catch',
      sensitivity: sCatch / totalS,
      description: 'Impact of early drive force. Derived dynamically from a +5% perturbation run.'
    },
    {
      phase: 'Mid-Drive',
      sensitivity: sMid / totalS,
      description: 'Impact of peak power phase. Derived dynamically from a +5% perturbation run.'
    },
    {
      phase: 'Finish',
      sensitivity: sFinish / totalS,
      description: 'Impact of late drive force. Derived dynamically from a +5% perturbation run.'
    },
    {
      phase: 'Recovery',
      sensitivity: 0.05, // Fixed reference baseline — not a measured perturbation
      description: 'Reference baseline only. Unlike the drive phases, this is a fixed display value, not a measured +5% perturbation. Recovery affects boat speed via inertial surge and check, but those effects are not isolated in this chart.'
    }
  ];
}
