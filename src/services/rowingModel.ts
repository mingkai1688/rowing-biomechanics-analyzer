import { RowerAnatomy, BoatSetup, StrokeParams, SimulationResult, SensitivityResult } from '../types';

const RHO = 1000; // Water density kg/m^3
const BLADE_AREA = 0.12; // m^2 (Smoothie/Macon style)
const BOAT_MASS = 14; // kg (Single scull)
const ROWER_MASS = 85; // kg
const ADDED_MASS = 10; // kg (Entrained water virtual mass)
const I_OAR = 1.5; // kg m^2 (Oar moment of inertia)
const L_SLIDE = 0.7; // m (Seat slide length)

export function simulateStroke(
  anatomy: RowerAnatomy,
  setup: BoatSetup,
  params: StrokeParams,
  forceMultiplier: { catch: number, mid: number, finish: number } = { catch: 1, mid: 1, finish: 1 }
): SimulationResult[] {
  const results: SimulationResult[] = [];
  const T = 60 / params.strokeRate;
  const dt = 0.002;
  
  const catchRad = (params.catchAngle * Math.PI) / 180;
  const finishRad = (params.finishAngle * Math.PI) / 180;
  const totalAngle = catchRad - finishRad;

  let vb = 0; // Start from rest
  let t_global = 0;

  for (let cycle = 0; cycle < params.cycles; cycle++) {
    let theta = catchRad;
    let omega = 0;
    let t_cycle = 0;
    
    // 1. DRIVE PHASE (Dynamic Integration)
    const driveResults: SimulationResult[] = [];
    // We integrate until the oar angle reaches the finish angle, preserving geometric constraints
    while (theta > finishRad && t_cycle < T) {
      const progress = (catchRad - theta) / totalAngle;
      
      let phaseMul = 1;
      let phase: SimulationResult['phase'] = 'Catch';
      if (progress < 0.33) { phase = 'Catch'; phaseMul = forceMultiplier.catch; }
      else if (progress < 0.66) { phase = 'Mid-Drive'; phaseMul = forceMultiplier.mid; }
      else { phase = 'Finish'; phaseMul = forceMultiplier.finish; }

      // Force-driven handle input: modified sine to avoid 0 initial force
      const F_handle = params.maxHandleForce * phaseMul * Math.sin(Math.PI * (progress * 0.9 + 0.05));
      
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
      const ar = L_SLIDE * (domega / totalAngle);
      
      // Advanced Hull Drag: Skin friction (v^1.85) + Wave making (v^4)
      const hullDrag = 2.5 * Math.pow(Math.max(0, vb), 1.85) + 0.05 * Math.pow(Math.max(0, vb), 4);
      
      // Coupled Two-Body System Acceleration
      const netForce = 2 * F_wx - hullDrag - ROWER_MASS * ar;
      const dvb = netForce / (BOAT_MASS + ROWER_MASS + ADDED_MASS);

      if (Math.round(t_cycle * 1000) % 10 === 0) {
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
          phase
        });
      }

      omega += domega * dt;
      theta -= omega * dt; // theta decreases during drive (bow towards stern)
      vb += dvb * dt;
      t_cycle += dt;
      t_global += dt;
    }

    const driveTime = t_cycle;
    const recoveryTime = Math.max(0.1, T - driveTime);
    
    // 2. RECOVERY PHASE (Kinematic Return)
    const recResults: SimulationResult[] = [];
    for (let t_rec = 0; t_rec < recoveryTime; t_rec += dt) {
      const phi = Math.PI * (t_rec / recoveryTime);
      
      // Kinematic seat acceleration (creates the characteristic velocity ripple)
      const ar = -(L_SLIDE / 2) * Math.pow(Math.PI / recoveryTime, 2) * Math.cos(phi);
      
      const hullDrag = 2.5 * Math.pow(Math.max(0, vb), 1.85) + 0.05 * Math.pow(Math.max(0, vb), 4);
      
      // Positive surge early recovery, negative 'check' late recovery
      const netForce = -hullDrag - ROWER_MASS * ar; 
      const dvb = netForce / (BOAT_MASS + ROWER_MASS + ADDED_MASS);
      
      const currentTheta = finishRad + totalAngle * 0.5 * (1 - Math.cos(phi));
      const currentOmega = -(totalAngle / 2) * (Math.PI / recoveryTime) * Math.sin(phi);

      if (Math.round(t_rec * 1000) % 10 === 0) {
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
          phase: 'Recovery'
        });
      }

      vb += dvb * dt;
      t_global += dt;
    }

    results.push(...driveResults, ...recResults);
  }

  return results;
}

export function calculateSensitivity(
  results: SimulationResult[], 
  anatomy: RowerAnatomy, 
  setup: BoatSetup, 
  params: StrokeParams
): SensitivityResult[] {
  // Extract steady-state (last cycle) average velocity
  const getSpeed = (res: SimulationResult[]) => {
    const lastCycle = res.filter(r => r.time >= Math.max(0, (params.cycles - 1)) * (60 / params.strokeRate));
    if (lastCycle.length === 0) return 0;
    return lastCycle.reduce((sum, r) => sum + r.boatVelocity, 0) / lastCycle.length;
  };
  
  const baseSpeed = getSpeed(results);

  // Perturbation runs (+5% force in specific phases)
  const resCatch = simulateStroke(anatomy, setup, params, { catch: 1.05, mid: 1.0, finish: 1.0 });
  const resMid = simulateStroke(anatomy, setup, params, { catch: 1.0, mid: 1.05, finish: 1.0 });
  const resFinish = simulateStroke(anatomy, setup, params, { catch: 1.0, mid: 1.0, finish: 1.05 });

  const sCatch = Math.max(0, getSpeed(resCatch) - baseSpeed);
  const sMid = Math.max(0, getSpeed(resMid) - baseSpeed);
  const sFinish = Math.max(0, getSpeed(resFinish) - baseSpeed);
  
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
      sensitivity: 0.05, // Fixed reference
      description: 'Recovery affects momentum via inertial surge and check, modeled as a fixed baseline sensitivity.'
    }
  ];
}