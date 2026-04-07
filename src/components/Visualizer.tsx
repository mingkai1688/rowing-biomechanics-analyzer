import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, FastForward } from 'lucide-react';
import { cn } from '../lib/utils';
import { BoatSetup, SimulationResult } from '../types';

function Oar({ angle, side, phase, liftForce, dragForce, setup }: { 
  angle: number, 
  side: 'left' | 'right', 
  phase: string,
  liftForce: number,
  dragForce: number,
  setup: BoatSetup
}) {
  // Scaling factor: 1m = 50 units
  const scale = 50;
  const pinX = side === 'left' ? 200 - (setup.span / 2) * scale : 200 + (setup.span / 2) * scale;
  const pinY = 100;
  
  // rotation: 0 is perpendicular to boat. 
  const rotation = side === 'left' ? -angle : angle;
  const isRecovery = phase === 'Recovery';
  
  const inboardLen = setup.inboard * scale;
  const outboardLen = setup.outboard * scale;
  
  // Angle of Attack (α) calculation
  const aoa = Math.abs(90 - Math.abs(angle));

  // Force vector scaling (for visualization)
  const forceScale = 0.05;
  const liftLen = Math.abs(liftForce) * forceScale;
  const dragLen = Math.abs(dragForce) * forceScale;

  return (
    <g transform={`translate(${pinX}, ${pinY}) rotate(${rotation})`}>
      {/* Inboard (towards center) */}
      <line x1="0" y1="0" x2={side === 'left' ? inboardLen : -inboardLen} y2="0" stroke="#94a3b8" strokeWidth="3" />
      {/* Outboard (away from center) */}
      <line x1="0" y1="0" x2={side === 'left' ? -outboardLen : outboardLen} y2="0" stroke="#334155" strokeWidth="4" />
      
      {/* Blade Group */}
      <g transform={`translate(${side === 'left' ? -outboardLen - 12 : outboardLen + 12}, 0)`}>
        {/* Blade Shape (Top-down view) */}
        <motion.rect 
          x="-12" 
          y={isRecovery ? -8 : -1} 
          width="24" 
          height={isRecovery ? 16 : 2} 
          rx="1" 
          fill={isRecovery ? "#475569" : "#3b82f6"} 
          animate={{ 
            height: isRecovery ? 16 : 2,
            y: isRecovery ? -8 : -1,
            fill: isRecovery ? "#475569" : "#3b82f6"
          }}
          transition={{ duration: 0.2 }}
        />
        
        {/* Hydrodynamic Angle Indicator (Only during drive) */}
        {!isRecovery && (
          <g transform="translate(0, 0)">
            {/* Force Vectors */}
            <motion.line 
              x1="0" y1="0" x2={side === 'left' ? liftLen : -liftLen} y2="0"
              stroke="#10b981" 
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${-rotation})`}
              animate={{ opacity: liftLen > 1 ? 1 : 0 }}
            />
            <motion.line 
              x1="0" y1="0" x2="0" y2={side === 'left' ? -dragLen : dragLen}
              stroke="#3b82f6" 
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${-rotation})`}
              animate={{ opacity: dragLen > 1 ? 1 : 0 }}
            />

            <line 
              x1="0" y1="-12" x2="0" y2="12" 
              stroke="white" 
              strokeWidth="0.5" 
              strokeOpacity="0.3"
              transform={`rotate(${-rotation})`} 
            />
            <motion.path
              d="M 0 -10 A 10 10 0 0 1 10 0"
              fill="none"
              stroke={aoa < 45 ? "#10b981" : "#3b82f6"}
              strokeWidth="2"
              strokeLinecap="round"
              animate={{ 
                stroke: aoa < 45 ? "#10b981" : "#3b82f6",
                opacity: [0.4, 0.8, 0.4]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <text 
              x="14" 
              y="3" 
              fill="white" 
              fontSize="8" 
              fontWeight="600" 
              transform={`rotate(${-rotation})`}
              className="select-none opacity-60"
            >
              {aoa.toFixed(0)}°
            </text>
            <text 
              x="14" 
              y="11" 
              fill={aoa < 45 ? "#10b981" : "#3b82f6"} 
              fontSize="6" 
              fontWeight="800" 
              transform={`rotate(${-rotation})`}
              className="select-none tracking-tighter"
            >
              {aoa < 45 ? `LIFT: ${Math.abs(liftForce).toFixed(0)}N` : `DRAG: ${Math.abs(dragForce).toFixed(0)}N`}
            </text>
            <circle 
              cx="0" cy="0" r="1.5" 
              fill={aoa < 45 ? "#10b981" : "#3b82f6"} 
              className="animate-pulse"
            />
          </g>
        )}
      </g>
    </g>
  );
}

export function Visualizer({ 
  currentData, setup, results, currentTime, setCurrentTime, isPlaying, setIsPlaying, playbackSpeed, setPlaybackSpeed
}: { 
  currentData: SimulationResult, setup: BoatSetup, results: SimulationResult[], currentTime: number, setCurrentTime: (v: number) => void,
  isPlaying: boolean, setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>,
  playbackSpeed: number, setPlaybackSpeed: React.Dispatch<React.SetStateAction<number>>
}) {
  return (
    <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-xl border border-slate-800">
      <div className="absolute top-4 left-4 z-10">
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
          currentData.phase === 'Catch' ? "bg-blue-500 text-white" :
          currentData.phase === 'Mid-Drive' ? "bg-emerald-500 text-white" :
          currentData.phase === 'Finish' ? "bg-amber-500 text-white" :
          "bg-slate-700 text-slate-300"
        )}>
          {currentData.phase} Phase
        </span>
      </div>
      
      <div className="w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 400 200" className="w-full h-full max-w-md">
          {/* Water ripples */}
          <motion.path 
            d="M 0 100 Q 100 90 200 100 T 400 100" 
            stroke="rgba(59, 130, 246, 0.2)" 
            fill="none" 
            strokeWidth="2"
            animate={{ d: ["M 0 100 Q 100 90 200 100 T 400 100", "M 0 100 Q 100 110 200 100 T 400 100"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
          
          {/* Riggers */}
          <line x1="185" y1="100" x2={200 - (setup.span / 2) * 50} y2="100" stroke="#475569" strokeWidth="2" />
          <line x1="215" y1="100" x2={200 + (setup.span / 2) * 50} y2="100" stroke="#475569" strokeWidth="2" />

          {/* Boat Hull */}
          <rect x="185" y="40" width="30" height="120" rx="15" fill="#334155" />
          
          {/* Oars */}
          <Oar 
            angle={currentData.oarAngle} 
            side="left" 
            phase={currentData.phase} 
            liftForce={currentData.liftForce}
            dragForce={currentData.dragForce}
            setup={setup}
          />
          <Oar 
            angle={currentData.oarAngle} 
            side="right" 
            phase={currentData.phase} 
            liftForce={currentData.liftForce}
            dragForce={currentData.dragForce}
            setup={setup}
          />
          
          {/* Rower (Simplified) */}
          <circle cx="200" cy="100" r="10" fill="#64748b" />
        </svg>
      </div>

      <div className="absolute bottom-4 left-6 right-6 flex flex-col gap-3 z-10">
        <input 
          type="range" 
          min={0} 
          max={results[results.length-1].time} 
          step={0.01} 
          value={currentTime}
          onChange={e => {
            setCurrentTime(parseFloat(e.target.value));
            setIsPlaying(false);
          }}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex items-center justify-between text-white">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-slate-300" /> : <Play className="w-4 h-4 text-slate-300 ml-0.5" />}
          </button>
          
          <div className="flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-full">
            <FastForward className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="range"
              min={0.25}
              max={3}
              step={0.25}
              value={playbackSpeed}
              onChange={e => setPlaybackSpeed(parseFloat(e.target.value))}
              className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-slate-300"
            />
            <span className="text-xs font-mono w-8 text-right text-slate-300">{playbackSpeed.toFixed(2)}x</span>
          </div>
        </div>
      </div>
    </div>
  );
}
