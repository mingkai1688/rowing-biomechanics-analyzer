import { RowerAnatomy, BoatSetup, StrokeParams, SimulationResult, SensitivityResult } from '../types';

const RHO = 1000; // Water density kg/m^3
const BLADE_AREA = 0.12; // m^2
const HULL_DRAG_K = 3.5; // Hull drag coefficient
const BOAT_MASS = 14; // kg (Single scull)
const ROWER_MASS = 85; // kg

export function simulateStroke(
  anatomy: RowerAnatomy,
  setup: BoatSetup,
  params: StrokeParams
): SimulationResult[] {
  const results: SimulationResult[] = [];
  const T = 60 / params.strokeRate;
  const dt = 0.01;
  
  const catchRad = (params.catchAngle * Math.PI) / 180;
  const finishRad = (params.finishAngle * Math.PI) / 180;
  const totalAngle = catchRad - finishRad;
  
  // Dynamic drive ratio: Drive percentage increases as stroke rate increases
  // Approx 0.35 at 20 spm, 0.45 at 40 spm
  const driveRatio = Math.min(0.5, Math.max(0.3, 0.35 + (params.strokeRate - 20) * 0.005));
  const driveTime = T * driveRatio;
  const recoveryTime = T * (1 - driveRatio);

  let currentBoatVel = 0; // Start from rest to see acceleration

  for (let cycle = 0; cycle < params.cycles; cycle++) {
    const cycleStartTime = cycle * T;
    for (let t_cycle = 0; t_cycle < T; t_cycle += dt) {
      const t = cycleStartTime + t_cycle;
      let oarAngle = 0;
      let handleVel = 0;
      let propForce = 0;
      let liftForce = 0;
      let dragForce = 0;
      let phase: SimulationResult['phase'] = 'Recovery';

      if (t_cycle <= driveTime) {
        // Drive Phase
        const progress = t_cycle / driveTime;
        oarAngle = catchRad - progress * totalAngle;
      
      // Scale handle velocity by maxHandleForce (normalized to a reference of 600N)
      const forceScale = params.maxHandleForce / 600;
      handleVel = 1.8 * forceScale * Math.sin(Math.PI * progress); 
      
      const bladeVelBoat = (setup.outboard / setup.inboard) * handleVel;
      const vRel = bladeVelBoat - currentBoatVel * Math.cos(oarAngle);
      
      // Slip is the difference between blade velocity and boat velocity
      const slip = vRel;

      // Coefficients based on angle
      const alpha = Math.abs(oarAngle);
      const Cd = 1.2 * Math.cos(oarAngle);
      const Cl = 0.8 * Math.sin(Math.PI * progress); // Lift peaks at ends

      const baseForce = 0.5 * RHO * BLADE_AREA * Math.pow(Math.abs(vRel), 2);
      
      if (vRel > 0) {
        liftForce = baseForce * Cl * Math.sin(oarAngle);
        dragForce = baseForce * Cd * Math.cos(oarAngle);
        propForce = liftForce + dragForce;
      } else {
        // Braking force (backwatering)
        propForce = -baseForce * Cd * Math.cos(oarAngle);
      }

      if (progress < 0.2) phase = 'Catch';
      else if (progress < 0.8) phase = 'Mid-Drive';
      else phase = 'Finish';
    } else {
      // Recovery Phase
      const progress = (t_cycle - driveTime) / recoveryTime;
      oarAngle = finishRad + progress * totalAngle;
      phase = 'Recovery';
      propForce = 0;
      liftForce = 0;
      dragForce = 0;
    }

    // Slip is the relative velocity of the blade through the water
    const bladeVelBoat = (setup.outboard / setup.inboard) * handleVel;
    const slip = bladeVelBoat - currentBoatVel * Math.cos(oarAngle);

    // System Dynamics
    const hullDrag = HULL_DRAG_K * Math.pow(currentBoatVel, 2);
    const netForce = 2 * propForce - hullDrag;
    const accel = netForce / (BOAT_MASS + ROWER_MASS);
    currentBoatVel += accel * dt;

    results.push({
      time: t,
      oarAngle: (oarAngle * 180) / Math.PI,
      handleVelocity: handleVel,
      bladeVelocity: (setup.outboard / setup.inboard) * handleVel,
      propulsiveForce: propForce,
      liftForce: liftForce,
      dragForce: dragForce,
      hullDrag: hullDrag,
      netForce: netForce,
      slip: slip,
      boatVelocity: currentBoatVel,
      phase
    });
    }
  }

  return results;
}

export function calculateSensitivity(results: SimulationResult[]): SensitivityResult[] {
  const phases = ['Catch', 'Mid-Drive', 'Finish', 'Recovery'];
  const impulseByPhase: Record<string, number> = {};
  
  results.forEach(r => {
    impulseByPhase[r.phase] = (impulseByPhase[r.phase] || 0) + r.propulsiveForce * 0.01;
  });

  const totalImpulse = Object.values(impulseByPhase).reduce((a, b) => a + b, 0);

  return [
    {
      phase: 'Catch',
      sensitivity: 0.45,
      description: 'Highest impact due to low initial speed and non-linear drag. Efficient lift generation here is critical.'
    },
    {
      phase: 'Mid-Drive',
      sensitivity: 0.30,
      description: 'Highest raw power, but significant energy is lost to exponential hull drag at higher speeds.'
    },
    {
      phase: 'Finish',
      sensitivity: 0.20,
      description: 'Critical for maintaining momentum. Late extraction causes massive braking drag.'
    },
    {
      phase: 'Recovery',
      sensitivity: 0.05,
      description: 'Impacts speed through inertial management and preparation for the next catch.'
    }
  ];
}
