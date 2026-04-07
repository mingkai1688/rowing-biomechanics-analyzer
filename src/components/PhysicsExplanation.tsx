import React from 'react';
import { BookOpen, Waves, Zap, Anchor } from 'lucide-react';

export function PhysicsExplanation() {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm mt-8">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <div className="p-2 bg-slate-100 rounded-lg">
          <BookOpen className="w-6 h-6 text-slate-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Physics & Equations Behind the Model</h2>
          <p className="text-sm text-slate-500 mt-1">A numerical integration approach to rowing biomechanics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Hydrodynamic Forces */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Waves className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Hydrodynamic Oar Forces</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The blade generates propulsion through a combination of <strong>Lift</strong> (moving water laterally) and <strong>Drag</strong> (pushing water backward), similar to an airplane wing.
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm space-y-3 overflow-x-auto">
            <p><span className="text-slate-400">Lift Force:</span> F<sub>L</sub> = ½ ρ A v<sub>rel</sub>² C<sub>L</sub> sin(θ)</p>
            <p><span className="text-slate-400">Drag Force:</span> F<sub>D</sub> = ½ ρ A v<sub>rel</sub>² C<sub>D</sub> cos(θ)</p>
          </div>
          <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
            <li><strong>ρ</strong>: Water density (1000 kg/m³)</li>
            <li><strong>A</strong>: Blade surface area (0.12 m²)</li>
            <li><strong>v<sub>rel</sub></strong>: Slip velocity (blade speed relative to water)</li>
            <li><strong>C<sub>L</sub>, C<sub>D</sub></strong>: Lift and Drag coefficients</li>
            <li><strong>θ</strong>: Oar angle relative to the boat</li>
          </ul>
        </div>

        {/* System Dynamics */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Zap className="w-5 h-5" />
            <h3 className="font-semibold text-lg">System Dynamics</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Newton's Second Law is applied to calculate the boat's acceleration. We subtract the hull's resistance from the total propulsive force of both oars.
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm space-y-3 overflow-x-auto">
            <p><span className="text-slate-400">Hull Drag:</span> F<sub>hull</sub> = k · v<sub>boat</sub>²</p>
            <p><span className="text-slate-400">Net Force:</span> F<sub>net</sub> = 2(F<sub>L</sub> + F<sub>D</sub>) - F<sub>hull</sub></p>
            <p><span className="text-slate-400">Acceleration:</span> a = F<sub>net</sub> / (m<sub>boat</sub> + m<sub>rower</sub>)</p>
          </div>
          <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
            <li><strong>k</strong>: Hull drag coefficient (3.5 for a single scull)</li>
            <li><strong>m<sub>boat</sub></strong>: Mass of the boat (14 kg)</li>
            <li><strong>m<sub>rower</sub></strong>: Mass of the rower (85 kg)</li>
          </ul>
        </div>

        {/* Blade Slip */}
        <div className="col-span-1 md:col-span-2 space-y-4 mt-4 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Anchor className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Understanding Blade Slip</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The most critical aspect of an efficient catch is managing <strong>Slip</strong>. It is the relative speed of the blade through the water.
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm overflow-x-auto">
            <p><span className="text-slate-400">Slip (v<sub>rel</sub>):</span> v<sub>blade</sub> - v<sub>boat</sub> · cos(θ)</p>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            If the blade enters the water while moving slower than the boat's forward progression, the slip becomes <strong>negative</strong>. When this happens, the hydrodynamic formulas yield a negative propulsive force (acting as a brake), which creates the "heavy catch" feeling known as <strong>backwatering</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}
