import React, { useState, useMemo, Suspense, useEffect, useRef } from 'react';
import { 
  Settings2, Activity, User, Anchor
} from 'lucide-react';
import { simulateStroke, calculateSensitivity, getAchievedStrokeRate, getAverageBoatSpeed } from './services/rowingModel';
import { RowerAnatomy, BoatSetup, StrokeParams, SimulationResult } from './types';
import { ControlSlider } from './components/ControlSlider';
import { Visualizer } from './components/Visualizer';

import { PhysicsExplanation } from './components/PhysicsExplanation';

// Lazy load chart components to reduce initial bundle size
const SensitivityChart = React.lazy(() => import('./components/Charts').then(m => ({ default: m.SensitivityChart })));
const DetailedCharts = React.lazy(() => import('./components/Charts').then(m => ({ default: m.DetailedCharts })));

export default function App() {
  const [anatomy, setAnatomy] = useState<RowerAnatomy>({
    legLength: 0.95,
    trunkLength: 0.65,
    armLength: 0.75
  });

  const [setup, setSetup] = useState<BoatSetup>({
    inboard: 0.88,
    outboard: 2.02,
    span: 1.60
  });

  const [params, setParams] = useState<StrokeParams>({
    catchAngle: 65,
    finishAngle: -40,
    strokeRate: 32,
    maxHandleForce: 600,
    cycles: 2,
    peakForcePercent: 0.5,
  });

  const results = useMemo(() => simulateStroke(anatomy, setup, params), [anatomy, setup, params]);
  const sensitivities = useMemo(() => calculateSensitivity(results, anatomy, setup, params), [results, anatomy, setup, params]);

  const zeroSlipPoints = useMemo(() => {
    // Find all points where slip becomes positive during drive phases
    const points: SimulationResult[] = [];
    results.forEach((r, i) => {
      if (r.phase === 'Recovery') return;
      const prev = results[i-1];
      if (!prev) {
        if (r.slip >= 0) points.push(r);
        return;
      }
      if (r.slip >= 0 && prev.slip < 0) {
        points.push(r);
      }
    });
    return points;
  }, [results]);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const lastUpdateRef = useRef<number>(0);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) return;

    lastUpdateRef.current = performance.now();

    const animate = (time: number) => {
      const delta = (time - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = time;

      setCurrentTime(prev => {
        const maxTime = results[results.length - 1].time;
        let nextTime = prev + delta * playbackSpeed;
        if (nextTime > maxTime) {
          nextTime = nextTime % maxTime;
        }
        return nextTime;
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, playbackSpeed, results]);

  // Binary search for the first sample whose time >= currentTime. results is
  // strictly time-ordered, so this is O(log N) per animation frame instead of O(N).
  const currentData = useMemo(() => {
    if (results.length === 0) return undefined;
    let lo = 0;
    let hi = results.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (results[mid].time >= currentTime) hi = mid;
      else lo = mid + 1;
    }
    return results[lo];
  }, [results, currentTime]) ?? results[0];

  const averageSpeed = useMemo(() => {
    return getAverageBoatSpeed(results).toFixed(2);
  }, [results]);

  const achievedStrokeRate = useMemo(() => getAchievedStrokeRate(results), [results]);
  const rateIsConstrained = Math.abs(achievedStrokeRate - params.strokeRate) > 1;

  const maxForce = useMemo(() => {
    let max = -Infinity;
    for (const r of results) {
      if (r.propulsiveForce > max) max = r.propulsiveForce;
    }
    return (max === -Infinity ? 0 : max).toFixed(0);
  }, [results]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Anchor className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Rowing Biomechanics</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Single Scull Analysis Model</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-slate-500 font-medium tracking-tighter">AVG SPEED</p>
            <p className="text-2xl font-bold text-blue-600">{averageSpeed} <span className="text-sm font-normal text-slate-400">m/s</span></p>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div className="text-right">
            <p className="text-xs text-slate-500 font-medium tracking-tighter">ACHIEVED RATE</p>
            <p className={`text-2xl font-bold ${rateIsConstrained ? 'text-amber-600' : 'text-blue-600'}`}>
              {achievedStrokeRate.toFixed(1)} <span className="text-sm font-normal text-slate-400">spm</span>
            </p>
            {rateIsConstrained && (
              <p className="text-xs font-semibold text-amber-600">Requested {params.strokeRate} spm</p>
            )}
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div className="text-right">
            <p className="text-xs text-slate-500 font-medium tracking-tighter">MAX FORCE</p>
            <p className="text-2xl font-bold text-emerald-600">{maxForce} <span className="text-sm font-normal text-slate-400">N</span></p>
          </div>
        </div>
      </header>

      <main className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto">
        {/* Controls Sidebar */}
        <aside className="lg:col-span-3 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-700">
              <User className="w-4 h-4" />
              <h2 className="font-semibold">Rower Anatomy (m)</h2>
            </div>
            <div className="space-y-4">
              <ControlSlider label="Legs" value={anatomy.legLength} min={0.7} max={1.2} step={0.01} onChange={v => setAnatomy(prev => ({...prev, legLength: v}))} />
              <ControlSlider label="Trunk" value={anatomy.trunkLength} min={0.5} max={0.9} step={0.01} onChange={v => setAnatomy(prev => ({...prev, trunkLength: v}))} />
              <ControlSlider label="Arms" value={anatomy.armLength} min={0.6} max={0.9} step={0.01} onChange={v => setAnatomy(prev => ({...prev, armLength: v}))} />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-700">
              <Settings2 className="w-4 h-4" />
              <h2 className="font-semibold">Boat Rigging (m)</h2>
            </div>
            <div className="space-y-4">
              <ControlSlider label="Inboard" value={setup.inboard} min={0.7} max={1.0} step={0.01} onChange={v => setSetup(prev => ({...prev, inboard: v}))} />
              <ControlSlider label="Outboard" value={setup.outboard} min={1.8} max={2.2} step={0.01} onChange={v => setSetup(prev => ({...prev, outboard: v}))} />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-700">
              <Activity className="w-4 h-4" />
              <h2 className="font-semibold">Stroke Parameters</h2>
            </div>
            <div className="space-y-4">
              <ControlSlider label="Catch Angle (°)" value={params.catchAngle} min={50} max={80} step={1} onChange={v => setParams(prev => ({...prev, catchAngle: v}))} />
              <ControlSlider label="Finish Angle (°)" value={params.finishAngle} min={-50} max={-20} step={1} onChange={v => setParams(prev => ({...prev, finishAngle: v}))} />
              <ControlSlider label="Rate (spm)" value={params.strokeRate} min={18} max={45} step={1} onChange={v => setParams(prev => ({...prev, strokeRate: v}))} />
              <ControlSlider label="Handle Force (N)" value={params.maxHandleForce} min={200} max={1200} step={10} onChange={v => setParams(prev => ({...prev, maxHandleForce: v}))} />
              <div>
                <ControlSlider label="Drive Peak Timing (%)" value={Math.round(params.peakForcePercent * 100)} min={20} max={80} step={5} onChange={v => setParams(prev => ({...prev, peakForcePercent: v / 100}))} />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Early Drive</span>
                  <span>Late Drive</span>
                </div>
              </div>
              <ControlSlider label="Cycles" value={params.cycles} min={2} max={5} step={1} onChange={v => setParams(prev => ({...prev, cycles: v}))} />
            </div>
          </section>
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* Top Row: Visualizer & Sensitivity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px]">
            <Visualizer 
              currentData={currentData} 
              setup={setup} 
              results={results} 
              currentTime={currentTime} 
              setCurrentTime={setCurrentTime} 
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              playbackSpeed={playbackSpeed}
              setPlaybackSpeed={setPlaybackSpeed}
            />

            <Suspense fallback={<div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-center text-slate-500 animate-pulse">Loading analysis...</div>}>
              <SensitivityChart sensitivities={sensitivities} />
            </Suspense>
          </div>

          {/* Bottom Row: Detailed Charts & Insights */}
          <Suspense fallback={<div className="h-[350px] bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-center text-slate-500 animate-pulse">Loading charts...</div>}>
            <DetailedCharts
              results={results}
              zeroSlipPoints={zeroSlipPoints}
              currentTime={currentTime}
            />
          </Suspense>

          {/* Physics Explanation */}
          <PhysicsExplanation />
        </div>
      </main>
    </div>
  );
}
