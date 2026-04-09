import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, AreaChart, Area, ReferenceLine, ReferenceDot 
} from 'recharts';
import { Wind, Info, Activity, Maximize2, Target } from 'lucide-react';
import { SimulationResult, SensitivityResult } from '../types';

export function SensitivityChart({ sensitivities, results }: { sensitivities: SensitivityResult[], results: SimulationResult[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Wind className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-lg">Phase Sensitivity Analysis</h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
          Catch Efficiency: {((results.find(r => r.phase === 'Catch')?.netForce || 0) / 10).toFixed(1)}%
        </div>
        <Info className="w-4 h-4 text-slate-400 cursor-help" />
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sensitivities} layout="vertical" margin={{ left: 20, right: 40 }}>
            <XAxis type="number" hide />
            <YAxis 
              dataKey="phase" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              width={80}
              tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }}
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl max-w-xs border border-slate-700">
                      <p className="font-bold mb-1">{data.phase}</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{data.description}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="sensitivity" radius={[0, 4, 4, 0]} barSize={32}>
              {sensitivities.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={
                    entry.phase === 'Catch' ? '#3b82f6' : 
                    entry.phase === 'Mid-Drive' ? '#10b981' : 
                    entry.phase === 'Finish' ? '#f59e0b' : '#94a3b8'
                  } 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DetailedCharts({ results, zeroSlipPoints, zeroSlipPoint, currentTime }: { results: SimulationResult[], zeroSlipPoints: SimulationResult[], zeroSlipPoint: SimulationResult | undefined, currentTime: number }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Force Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-[350px]">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Propulsive Force Profile (N)
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={results}>
              <defs>
                <linearGradient id="colorForce" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(v) => `${v.toFixed(1)}s`}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                labelFormatter={(v) => `Time: ${v}s`}
              />
              <Area type="monotone" dataKey="propulsiveForce" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorForce)" />
              <ReferenceLine x={currentTime} stroke="#334155" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Velocity Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-[350px]">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-blue-500" />
            System Velocity (m/s)
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={results}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(v) => `${v.toFixed(1)}s`}
              />
              <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                labelFormatter={(v) => `Time: ${v}s`}
              />
              <Line type="monotone" dataKey="boatVelocity" stroke="#3b82f6" strokeWidth={3} dot={false} />
              <ReferenceLine x={currentTime} stroke="#334155" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Net Force & Slip Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-lg">Net Force & Slip</h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-slate-500">Net Force (N)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-slate-500">Slip (m/s)</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="time" 
                  type="number"
                  domain={[0, 'dataMax']}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v.toFixed(1)}s`}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs">
                          <p className="font-bold mb-1">Time: {payload[0].payload.time.toFixed(2)}s</p>
                          <p className="text-indigo-400">Net Force: {payload[0].value.toFixed(1)}N</p>
                          <p className="text-rose-400">Slip: {payload[1].value.toFixed(2)}m/s</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area yAxisId="left" type="monotone" dataKey="netForce" stroke="#6366f1" fillOpacity={1} fill="url(#colorNet)" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="slip" stroke="#f43f5e" strokeWidth={2} dot={false} />
                <ReferenceLine yAxisId="left" x={currentTime} stroke="#334155" strokeDasharray="3 3" />
                
                {zeroSlipPoints.map((point, idx) => (
                  <React.Fragment key={`catch-${idx}`}>
                    <ReferenceLine 
                      yAxisId="right"
                      x={point.time} 
                      stroke="#f43f5e" 
                      strokeWidth={1} 
                      strokeDasharray="5 5"
                      label={{ 
                        position: 'bottom', 
                        value: `Catch: ${point.time.toFixed(2)}s`, 
                        fill: '#f43f5e', 
                        fontSize: 10, 
                        fontWeight: 'bold',
                        offset: 10
                      }} 
                    />
                    <ReferenceDot 
                      yAxisId="right"
                      x={point.time} 
                      y={point.slip} 
                      r={0} 
                      shape={(props: any) => {
                        const { cx, cy } = props;
                        return (
                          <g transform={`translate(${cx},${cy})`}>
                            <line x1="-10" y1="-10" x2="10" y2="10" stroke="#f43f5e" strokeWidth="4" />
                            <line x1="10" y1="-10" x2="-10" y2="10" stroke="#f43f5e" strokeWidth="4" />
                          </g>
                        );
                      }}
                    />
                  </React.Fragment>
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hull Drag Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-[350px]">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Wind className="w-4 h-4 text-slate-500" />
            Hull Drag Profile (N)
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={results}>
              <defs>
                <linearGradient id="colorDrag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(v) => `${v.toFixed(1)}s`}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                labelFormatter={(v) => `Time: ${v}s`}
              />
              <Area type="monotone" dataKey="hullDrag" stroke="#64748b" strokeWidth={3} fillOpacity={1} fill="url(#colorDrag)" />
              <ReferenceLine x={currentTime} stroke="#334155" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Biomechanics Insight */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-600 rounded-xl text-white">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 text-lg mb-2">Optimal Catch Timing Insight</h3>
            <p className="text-blue-800 text-sm leading-relaxed max-w-4xl">
              The "Best Time" to catch is when the <strong>Slip</strong> (Blade Velocity relative to Water) is positive but minimal. 
              If you catch too early (while the blade is moving slower than the boat), you create <strong>Backwatering</strong>, 
              which acts as a massive brake. The ideal moment is when your handle acceleration ensures the blade 
              enters the water at exactly the boat's speed and immediately begins to accelerate. 
              Watch the <strong>Net Force</strong> chart: a sharp dip at the start of the drive indicates a "Heavy Catch" 
              where drag temporarily outweighs propulsion.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
