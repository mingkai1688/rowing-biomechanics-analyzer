export interface RowerAnatomy {
  legLength: number;
  trunkLength: number;
  armLength: number;
}

export interface BoatSetup {
  inboard: number;
  outboard: number;
  span: number;
}

export interface StrokeParams {
  catchAngle: number; // degrees
  finishAngle: number; // degrees
  strokeRate: number; // strokes per minute
  maxHandleForce: number; // Newtons
  cycles: number; // number of stroke cycles to simulate
}

export interface SimulationResult {
  time: number;
  oarAngle: number;
  handleVelocity: number;
  bladeVelocity: number;
  propulsiveForce: number;
  liftForce: number;
  dragForce: number;
  hullDrag: number;
  netForce: number;
  slip: number;
  boatVelocity: number;
  seatPosition: number;
  phase: 'Catch' | 'Mid-Drive' | 'Finish' | 'Recovery';
}

export interface SensitivityResult {
  phase: string;
  sensitivity: number;
  description: string;
}
