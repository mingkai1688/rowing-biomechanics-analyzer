import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateSensitivity,
  estimateSlideLength,
  getAverageBoatSpeed,
  getAchievedStrokeRate,
  getLastCycleResults,
  simulateStroke,
} from '../src/services/rowingModel';
import { BoatSetup, RowerAnatomy, StrokeParams } from '../src/types';

const anatomy: RowerAnatomy = {
  legLength: 0.95,
  trunkLength: 0.65,
  armLength: 0.75,
};

const setup: BoatSetup = {
  inboard: 0.88,
  outboard: 2.02,
  span: 1.6,
};

const params: StrokeParams = {
  catchAngle: 65,
  finishAngle: -40,
  strokeRate: 32,
  maxHandleForce: 600,
  cycles: 2,
  peakForcePercent: 0.5,
};

const numericFields = [
  'time',
  'oarAngle',
  'handleVelocity',
  'bladeVelocity',
  'propulsiveForce',
  'liftForce',
  'dragForce',
  'hullDrag',
  'netForce',
  'slip',
  'boatVelocity',
  'seatPosition',
] as const;

const ROWER_MASS = 85;
const MAX_SEAT_ACCEL = 15;

describe('simulateStroke', () => {
  it('returns finite, time-ordered samples across drive and recovery phases', () => {
    const results = simulateStroke(anatomy, setup, params);

    assert.ok(results.length > 200);
    assert.equal(results[0].phase, 'Catch');
    assert.ok(results.some((result) => result.phase === 'Recovery'));
    assert.ok(results.some((result) => result.phase === 'Mid-Drive'));
    assert.ok(results.some((result) => result.phase === 'Finish'));

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      for (const field of numericFields) {
        assert.ok(Number.isFinite(result[field]), `${field} should be finite at index ${i}`);
      }

      if (i > 0) {
        assert.ok(result.time > results[i - 1].time, `time should increase at index ${i}`);
      }
    }
  });

  it('keeps simulated outputs inside expected baseline ranges', () => {
    const results = simulateStroke(anatomy, setup, params);
    const maxForce = Math.max(...results.map((result) => result.propulsiveForce));
    const averageSpeed = getAverageBoatSpeed(results);
    const minSeatPosition = Math.min(...results.map((result) => result.seatPosition));
    const maxSeatPosition = Math.max(...results.map((result) => result.seatPosition));
    const targetDuration = params.cycles * 60 / params.strokeRate;
    const actualDuration = results.at(-1)?.time ?? 0;

    assert.ok(maxForce > 400 && maxForce < 525, `unexpected max force ${maxForce}`);
    // The longer recovery changes the last-cycle sample mix; re-baselined from
    // the old ~4.5 m/s range to the corrected 4.357 m/s result.
    assert.ok(averageSpeed > 4.30 && averageSpeed < 4.42, `unexpected average speed ${averageSpeed}`);
    assert.ok(minSeatPosition >= 0 && minSeatPosition < 0.01, `unexpected min seat ${minSeatPosition}`);
    assert.ok(maxSeatPosition > 0.68 && maxSeatPosition <= 0.75, `unexpected max seat ${maxSeatPosition}`);
    // The requested period is no longer forced when its remaining recovery
    // would violate the seat-acceleration floor, so the actual cycle may be longer.
    assert.ok(actualDuration > targetDuration, `duration ${actualDuration} should exceed ${targetDuration}`);
    assert.ok(actualDuration > 4.14 && actualDuration < 4.17, `unexpected duration ${actualDuration}`);
  });

  it('bounds peak recovery seat acceleration across representative UI parameters', () => {
    const cases = [
      { anatomy, setup, params: { ...params, strokeRate: 18 } },
      {
        anatomy: { legLength: 0.7, trunkLength: 0.5, armLength: 0.6 },
        setup: { inboard: 0.7, outboard: 2.2, span: 1.6 },
        params: { ...params, catchAngle: 50, finishAngle: -20, strokeRate: 18, maxHandleForce: 400 },
      },
      {
        anatomy: { legLength: 1.2, trunkLength: 0.9, armLength: 0.9 },
        setup: { inboard: 1, outboard: 1.8, span: 1.6 },
        params: { ...params, catchAngle: 80, finishAngle: -50, strokeRate: 18, maxHandleForce: 1200 },
      },
      {
        anatomy: { legLength: 1.2, trunkLength: 0.5, armLength: 0.9 },
        setup: { inboard: 0.85, outboard: 2, span: 1.6 },
        params: { ...params, strokeRate: 18, maxHandleForce: 800, peakForcePercent: 0.8 },
      },
    ] satisfies Array<{ anatomy: RowerAnatomy; setup: BoatSetup; params: StrokeParams }>;

    for (const testCase of cases) {
      const results = simulateStroke(testCase.anatomy, testCase.setup, testCase.params);
      const peakRecoveryAcceleration = Math.max(
        ...results
          .filter((result) => result.phase === 'Recovery')
          .map((result) => Math.abs((-result.netForce - result.hullDrag) / ROWER_MASS)),
      );

      assert.ok(
        peakRecoveryAcceleration <= MAX_SEAT_ACCEL + 0.1,
        `recovery acceleration ${peakRecoveryAcceleration.toFixed(3)} m/s^2 exceeds the bound`,
      );
    }
  });

  it('keeps default recovery net force within the same order as drive net force', () => {
    const results = simulateStroke(anatomy, setup, params);
    const peakDrive = Math.max(
      ...results.filter((result) => result.phase !== 'Recovery').map((result) => Math.abs(result.netForce)),
    );
    const peakRecovery = Math.max(
      ...results.filter((result) => result.phase === 'Recovery').map((result) => Math.abs(result.netForce)),
    );

    assert.ok(peakRecovery <= peakDrive * 5, `recovery/drive force ratio was ${peakRecovery / peakDrive}`);
  });

  it('reports requested rate when achievable and a lower achieved rate when constrained', () => {
    const achievableParams = { ...params, strokeRate: 18, maxHandleForce: 1200 };
    const constrainedParams = { ...params, strokeRate: 45, maxHandleForce: 600 };
    const achievableRate = getAchievedStrokeRate(simulateStroke(anatomy, setup, achievableParams));
    const constrainedRate = getAchievedStrokeRate(simulateStroke(anatomy, setup, constrainedParams));

    assert.ok(Math.abs(achievableRate - achievableParams.strokeRate) < 0.1);
    assert.ok(constrainedRate < constrainedParams.strokeRate - 1);
  });

  it('extracts final-cycle samples for steady-state metrics', () => {
    const results = simulateStroke(anatomy, setup, { ...params, cycles: 3 });
    const lastCycle = getLastCycleResults(results);

    assert.ok(lastCycle.length > 100);
    assert.equal(lastCycle[0].phase, 'Catch');
    assert.ok(lastCycle[0].time > 0);
    assert.ok(getAverageBoatSpeed(results) > 0);
  });

  it('uses anatomy to change slide length and simulated motion', () => {
    const compactAnatomy: RowerAnatomy = {
      legLength: 0.7,
      trunkLength: 0.5,
      armLength: 0.6,
    };
    const tallAnatomy: RowerAnatomy = {
      legLength: 1.2,
      trunkLength: 0.9,
      armLength: 0.9,
    };
    const compactResults = simulateStroke(compactAnatomy, setup, params);
    const tallResults = simulateStroke(tallAnatomy, setup, params);
    const compactSeatMax = Math.max(...compactResults.map((result) => result.seatPosition));
    const tallSeatMax = Math.max(...tallResults.map((result) => result.seatPosition));

    assert.ok(estimateSlideLength(compactAnatomy) < estimateSlideLength(tallAnatomy));
    assert.ok(compactSeatMax < tallSeatMax);
    assert.notEqual(getAverageBoatSpeed(compactResults), getAverageBoatSpeed(tallResults));
  });

  it('clamps peak force timing to the documented 20-80 percent range', () => {
    const earlyClamped = simulateStroke(anatomy, setup, { ...params, peakForcePercent: 0.01 });
    const earlyBoundary = simulateStroke(anatomy, setup, { ...params, peakForcePercent: 0.2 });
    const lateClamped = simulateStroke(anatomy, setup, { ...params, peakForcePercent: 0.99 });
    const lateBoundary = simulateStroke(anatomy, setup, { ...params, peakForcePercent: 0.8 });

    assert.deepEqual(earlyClamped, earlyBoundary);
    assert.deepEqual(lateClamped, lateBoundary);
  });

  // Rigging/anatomy that the UI sliders allow but which the rower cannot actually
  // drive through: minimum handle force, worst leverage (short inboard, long
  // outboard) and the longest arc. The oar never reaches the finish angle, so the
  // drive loop exits on its 5s safety cap partway through the stroke.
  const stalledParams: StrokeParams = {
    catchAngle: 80,
    finishAngle: -50,
    strokeRate: 18,
    maxHandleForce: 200,
    cycles: 1,
    peakForcePercent: 0.8,
  };
  const stalledAnatomy: RowerAnatomy = { legLength: 1.2, trunkLength: 0.9, armLength: 0.75 };
  const stalledSetup: BoatSetup = { inboard: 0.7, outboard: 2.2, span: 1.6 };

  it('hands a stalled drive to recovery without teleporting the oar or seat', () => {
    const results = simulateStroke(stalledAnatomy, stalledSetup, stalledParams);
    const lastDrive = results.filter((r) => r.phase !== 'Recovery').at(-1)!;
    const firstRecovery = results.find((r) => r.phase === 'Recovery')!;

    // Confirm this configuration really does stall short of the finish angle,
    // otherwise the continuity assertions below prove nothing.
    assert.ok(
      lastDrive.oarAngle - stalledParams.finishAngle > 2,
      `expected a stalled drive, but it reached ${lastDrive.oarAngle}deg`,
    );

    const angleJump = Math.abs(firstRecovery.oarAngle - lastDrive.oarAngle);
    const seatJump = Math.abs(firstRecovery.seatPosition - lastDrive.seatPosition);

    assert.ok(angleJump < 2, `oar angle jumped ${angleJump.toFixed(2)}deg into recovery`);
    assert.ok(seatJump < 0.02, `seat jumped ${seatJump.toFixed(4)}m into recovery`);
  });

  // Guard rather than bug reproduction: a stalled recovery must still complete the
  // return to the catch. Tolerances are relative because the final sample lands one
  // 10ms sampling step short of the analytic endpoint on every run, stalled or not.
  it('returns the oar and seat to the catch even when the drive stalled', () => {
    const results = simulateStroke(stalledAnatomy, stalledSetup, stalledParams);
    const lastSample = results.at(-1)!;
    const arc = stalledParams.catchAngle - stalledParams.finishAngle;
    const slideLength = estimateSlideLength(stalledAnatomy);

    assert.ok(
      (stalledParams.catchAngle - lastSample.oarAngle) / arc < 0.05,
      `recovery ended at ${lastSample.oarAngle}deg, too far from the catch`,
    );
    assert.ok(
      Math.abs(lastSample.seatPosition) / slideLength < 0.05,
      `recovery ended with the seat at ${lastSample.seatPosition}m, expected the catch`,
    );
  });

  it('shifts the propulsive impulse forward when peakForcePercent moves later', () => {
    // peakForcePercent shifts the handle-force envelope, which biases the
    // distribution of propulsive impulse across the drive. Late-peak runs should
    // deliver a larger fraction of impulse in the second half of the drive than
    // early-peak runs. (Peak propulsive force timing itself is dominated by V²
    // dynamics and not a reliable proxy for the handle-force peak.)
    const lateFractionInLateHalf = (peakForcePercent: number) => {
      const last = getLastCycleResults(
        simulateStroke(anatomy, setup, { ...params, peakForcePercent })
      );
      const drive = last.filter((s) => s.phase !== 'Recovery');
      const half = Math.floor(drive.length / 2);
      const total = drive.reduce((sum, s) => sum + Math.max(0, s.propulsiveForce), 0);
      const lateHalf = drive.slice(half).reduce((sum, s) => sum + Math.max(0, s.propulsiveForce), 0);
      return lateHalf / Math.max(1e-9, total);
    };

    const earlyShare = lateFractionInLateHalf(0.2);
    const lateShare = lateFractionInLateHalf(0.8);

    assert.ok(
      lateShare > earlyShare,
      `late-peak should put more impulse in the late half (early=${earlyShare.toFixed(2)}, late=${lateShare.toFixed(2)})`,
    );
    assert.ok(
      lateShare - earlyShare > 0.05,
      `expected a meaningful shift in impulse distribution (got Δ=${(lateShare - earlyShare).toFixed(2)})`,
    );
  });
});

describe('getLastCycleResults', () => {
  it('returns an empty array when given no samples', () => {
    assert.deepEqual(getLastCycleResults([]), []);
  });

  it('returns the whole array when no Recovery→drive transition exists', () => {
    const onlyDrive = simulateStroke(anatomy, setup, params).filter((r) => r.phase !== 'Recovery');
    assert.equal(getLastCycleResults(onlyDrive).length, onlyDrive.length);
  });

  it('starts the last cycle at the first non-recovery sample after recovery', () => {
    const results = simulateStroke(anatomy, setup, { ...params, cycles: 3 });
    const last = getLastCycleResults(results);
    const startIdx = results.length - last.length;

    assert.ok(startIdx > 0, 'expected a non-zero start index for a multi-cycle run');
    assert.equal(results[startIdx - 1].phase, 'Recovery');
    assert.notEqual(last[0].phase, 'Recovery');
  });
});

describe('calculateSensitivity', () => {
  it('returns normalized finite drive phase sensitivities', () => {
    const results = simulateStroke(anatomy, setup, params);
    const sensitivities = calculateSensitivity(results, anatomy, setup, params);
    const driveSensitivity = sensitivities
      .filter((result) => result.phase !== 'Recovery')
      .reduce((sum, result) => sum + result.sensitivity, 0);

    assert.equal(sensitivities.length, 4);
    assert.ok(Math.abs(driveSensitivity - 1) < 0.01, `unexpected drive sensitivity sum ${driveSensitivity}`);
    for (const result of sensitivities) {
      assert.ok(Number.isFinite(result.sensitivity), `${result.phase} sensitivity should be finite`);
      assert.ok(result.sensitivity >= 0, `${result.phase} sensitivity should not be negative`);
    }
  });

  it('returns the four expected phases in display order', () => {
    const results = simulateStroke(anatomy, setup, params);
    const sensitivities = calculateSensitivity(results, anatomy, setup, params);
    assert.deepEqual(
      sensitivities.map((s) => s.phase),
      ['Catch', 'Mid-Drive', 'Finish', 'Recovery'],
    );
  });
});
