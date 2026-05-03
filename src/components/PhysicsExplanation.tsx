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
          <p className="text-sm text-slate-500 mt-1">A numerical integration approach to two-body rowing biomechanics</p>
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
            The blade generates propulsion by accelerating water. The model determines the true flow vector against the blade, calculating an Angle of Attack (α) to determine Normal and Tangential forces.
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm space-y-3 overflow-x-auto">
            <p><span className="text-slate-400">Normal Force:</span> F<sub>N</sub> = ½ ρ A V² C<sub>N</sub>(α)</p>
            <p><span className="text-slate-400">Tangential:</span> F<sub>T</sub> = ½ ρ A V² C<sub>T</sub>(α)</p>
            <p><span className="text-slate-400">Propulsion:</span> F<sub>wx</sub> = F<sub>N</sub> cos(θ) - F<sub>T</sub> sin(θ)</p>
          </div>
          <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
            <li><strong>ρ</strong>: Water density (1000 kg/m³)</li>
            <li><strong>V</strong>: Total flow velocity against the blade</li>
            <li><strong>α</strong>: Hydrodynamic angle of attack</li>
            <li><strong>C<sub>N</sub>, C<sub>T</sub></strong>: Force coefficients (Caplan & Gardner approximations)</li>
          </ul>
        </div>

        {/* System Dynamics */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Zap className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Two-Body System Dynamics</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The simulation treats the boat and the rower as two distinct masses connected by the footstretcher. As the rower slides back and forth during the drive and recovery, internal momentum is transferred.
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm space-y-3 overflow-x-auto">
            <p><span className="text-slate-400">Hull Resistance:</span> D = k<sub>f</sub> v<sup>1.85</sup> + k<sub>w</sub> v<sup>4</sup></p>
            <p><span className="text-slate-400">Net Force:</span> F<sub>net</sub> = 2(F<sub>wx</sub>) - D - m<sub>rower</sub>(a<sub>slide</sub>)</p>
            <p><span className="text-slate-400">Acceleration:</span> a = F<sub>net</sub> / (m<sub>boat</sub> + m<sub>rower</sub> + m<sub>virtual</sub>)</p>
          </div>
          <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
            <li><strong>D</strong>: Drag comprised of skin friction & wave resistance</li>
            <li><strong>a<sub>slide</sub></strong>: Rower acceleration relative to the hull</li>
            <li><strong>m<sub>virtual</sub></strong>: Entrained water added mass (~10kg)</li>
          </ul>
        </div>

        {/* Blade Slip */}
        <div className="col-span-1 md:col-span-2 space-y-4 mt-4 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Anchor className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Torque Integration & Slip</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Rather than rigidly prescribing handle speed, the model takes a <strong>Force input</strong>. The angular acceleration of the oar is integrated dynamically over time. If handle force is insufficient to overcome the boat's speed, the blade velocity through the water (Slip) becomes negative, generating backward "braking" force (backwatering).
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm overflow-x-auto">
            <p><span className="text-slate-400">Angular Acceleration:</span> α<sub>oar</sub> = (F<sub>handle</sub> L<sub>in</sub> - F<sub>N</sub> L<sub>out</sub>) / I<sub>oar</sub></p>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mt-2">
            The "heavy catch" effect is accurately modeled by evaluating the angular speed against the forward velocity of the shell.
          </p>
        </div>
      </div>
    </section>
  );
}
