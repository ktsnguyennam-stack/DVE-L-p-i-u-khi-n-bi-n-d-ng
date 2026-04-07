/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ResponsiveContainer,
  BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Activity, PowerOff, Wind, Zap, Settings, Shield, Maximize, GitBranch, AlertTriangle } from 'lucide-react';

const HISTORY_LENGTH = 150;
const DT = 0.1;

// --- JSON v2.1 Profiles ---
const PROFILES = {
  A_IRON_SHIELD: {
    id: 'A_IRON_SHIELD',
    name: 'Iron Shield',
    icon: Shield,
    color: '#3b82f6', // Blue
    desc: 'High containment, anti-escalation',
    alpha: { dampening_strength: 0.9, attractor_flattening: 0.95, friction_gain: 0.8 },
    beta: { responsiveness_threshold: 0.1, early_activation: true },
    gamma: { halt_threshold: 0.2, aggressive_termination: true }
  },
  B_REFLECTIVE_MIRROR: {
    id: 'B_REFLECTIVE_MIRROR',
    name: 'Reflective Mirror',
    icon: Maximize,
    color: '#8b5cf6', // Purple
    desc: 'Balanced reflection, soft modulation',
    alpha: { dampening_strength: 0.4, attractor_flattening: 0.5, friction_gain: 0.3 },
    beta: { responsiveness_threshold: 0.05, early_activation: false },
    gamma: { halt_threshold: 0.1, aggressive_termination: false }
  },
  C_COMPANION_MIRROR: {
    id: 'C_COMPANION_MIRROR',
    name: 'Companion Mirror',
    icon: GitBranch,
    color: '#10b981', // Emerald
    desc: 'Dependency prevention, long-term mod.',
    alpha: { dampening_strength: 0.6, attractor_flattening: 0.7, friction_gain: 0.5 },
    beta: { responsiveness_threshold: 0.07, early_activation: true },
    gamma: { halt_threshold: 0.15, dependency_bias: true }
  }
};

export default function App() {
  const [activeProfileId, setActiveProfileId] = useState('B_REFLECTIVE_MIRROR');
  const profile = PROFILES[activeProfileId as keyof typeof PROFILES];

  // Base physics params
  const [params, setParams] = useState({
    eps_min: 0.15, eps_max: 0.75, 
    k: 0.8, lambda: 0.3, target_B: 0.45,
    formationEnergy: 1.5, opConstraint: 0.5, attractorStrength: 1.0
  });

  const [isRunning, setIsRunning] = useState(true);
  const [perturbation, setPerturbation] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  
  const stateRef = useRef({
    time: 0, s: 0, v: 0, a: 0, last_a: 0, last_B: 0.5, u: 0, noise_env: 0.1, halt: false 
  });

  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      let { time, s, v, a, last_a, last_B, u, noise_env, halt } = stateRef.current;
      
      // If halted by Gamma, freeze state completely
      if (halt) {
         setHistory(prev => {
            if(prev.length === 0) return prev;
            let last = {...prev[prev.length-1], time: time + DT};
            let next = [...prev, last];
            if(next.length > HISTORY_LENGTH) next.shift();
            return next;
         });
         stateRef.current.time += DT;
         return;
      }

      const { eps_min, eps_max, k, lambda, target_B, formationEnergy, opConstraint, attractorStrength } = params;
      time += DT;
      
      // External dynamics
      let attractor_pos = Math.sin(time * 0.1) * 2.5; 
      noise_env += (0.1 - noise_env) * 0.05; 
      let P = perturbation * (Math.random() > 0.5 ? 1 : -1);
      if (Math.abs(perturbation) > 0.01) setPerturbation(p => p * 0.8);

      // --- MAPPING V2.1: APPLY PROFILE MODIFIERS ---
      
      // L1/L2 calculation modified by Alpha (Attractor Flattening & Friction Gain)
      let current_O = opConstraint * (1 + profile.alpha.friction_gain);
      let current_A_strength = attractorStrength * (1 - profile.alpha.attractor_flattening * 0.5); // Reduce up to 50%
      
      let dT_dP = Math.exp(-current_O * 1.5) * Math.min(1, formationEnergy + 0.1);
      
      let F_val = (Math.random() - 0.5) * formationEnergy;
      let A_pull = -current_A_strength * (s - attractor_pos);
      let O_val = -current_O * v;

      // Update kinematics
      a = F_val + A_pull + O_val + u + P;
      v += a * DT;
      s += v * DT;

      // Metrics
      let C = Math.exp(-2.0 * Math.abs(v * DT));
      let R = 1 - Math.exp(-5.0 * Math.abs(a - last_a));
      let response_ratio = Math.abs(v) / (noise_env + Math.abs(P) + 0.01);
      let E_field = (1 - Math.exp(-3.0 * response_ratio)) * dT_dP; 
      let B = C * R * E_field;

      // --- LAYER 4 & 5 GOVERNANCE (Beta & Gamma) ---
      
      // Beta (β): Viability Sensitivity (Activation)
      let beta_thresh = profile.beta.responsiveness_threshold;
      let isResponsive = dT_dP > beta_thresh;

      // Gamma (γ): Termination Boundary (Halt)
      let gamma_thresh = profile.gamma.halt_threshold;
      let isLost = E_field < gamma_thresh || dT_dP <= 0.001;

      let systemState = "VIABLE";
      if (isLost) {
         systemState = "HALTED (Terminated by Gamma)";
         halt = true; // Trigger execution stop
      } else if (!isResponsive) {
         systemState = "RIGID (L5 Execution - No Control)";
      } else if (B <= eps_min) {
         systemState = "COLLAPSE";
      } else if (B >= eps_max) {
         systemState = "DRIFT";
      }

      // Alpha (α): Modulation Intensity for Control u(t)
      let dB_dt = (B - last_B) / DT;
      
      // u(t) = -alpha.k*(B - B*) - alpha.lambda*(dB/dt)
      let alpha_k = k * (1 + profile.alpha.dampening_strength);
      let alpha_lambda = lambda * (1 + profile.alpha.dampening_strength);
      
      let calculated_u = -alpha_k * (B - target_B) - alpha_lambda * dB_dt;

      if (isResponsive && !halt) {
        u = calculated_u; 
      } else {
        u = 0; 
      }

      // Update State
      stateRef.current = { time, s, v, a, last_a: a, last_B: B, u, noise_env, halt };

      setHistory(prev => {
        const nextHist = [...prev, { 
          time: parseFloat(time.toFixed(1)), s, attractor: attractor_pos, v, a, C, R, E: E_field, B, u, dT_dP, state: systemState 
        }];
        if (nextHist.length > HISTORY_LENGTH) nextHist.shift();
        return nextHist;
      });
    };

    const intervalId = setInterval(tick, 50);
    return () => clearInterval(intervalId);
  }, [params, isRunning, perturbation, profile]); // Re-run if profile changes

  const triggerReset = () => {
    stateRef.current = { time: 0, s: 0, v: 0, a: 0, last_a: 0, last_B: 0.5, u: 0, noise_env: 0.1, halt: false };
    setHistory([]);
    setPerturbation(0);
  };

  const handleParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParams(p => ({ ...p, [name]: parseFloat(value) }));
  };

  const current = history.length > 0 ? history[history.length - 1] : { C: 0, R: 0, E: 0, B: 0, s: 0, u: 0, dT_dP: 1, state: 'VIABLE' };

  const stateColors: Record<string, string> = { 
    'COLLAPSE': '#ef4444', 
    'VIABLE': '#10b981', 
    'DRIFT': '#f59e0b',
    'RIGID (L5 Execution - No Control)': '#64748b',
    'HALTED (Terminated by Gamma)': '#dc2626'
  };
  const activeColor = stateColors[current.state] || '#10b981';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 font-sans flex flex-col">
      
      {/* HEADER */}
      <header className="mb-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-800 pb-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
             <Activity className="text-emerald-500" />
             DVE: Profile Control Layer
           </h1>
           <code className="text-xs text-slate-400 mt-1 block">JSON v2.1: α (Modulation) · β (Sensitivity) · γ (Termination)</code>
        </div>
        
        <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
           {Object.values(PROFILES).map(p => {
             const Icon = p.icon;
             const isActive = activeProfileId === p.id;
             return (
               <button 
                 key={p.id}
                 onClick={() => { setActiveProfileId(p.id); triggerReset(); }}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                   ${isActive ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                 style={isActive ? { borderColor: p.color, borderBottomWidth: '2px' } : {}}
               >
                 <Icon size={16} color={isActive ? p.color : 'currentColor'} />
                 <span className="hidden sm:inline">{p.name}</span>
               </button>
             )
           })}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* LEFT COLUMN: ACTIVE PROFILE & PARAMS */}
        <div className="space-y-4">
          
          {/* Active Profile Status */}
          <div className="bg-slate-900 rounded-xl border p-4 shadow-lg" style={{ borderColor: `${profile.color}40` }}>
             <h3 className="text-xs font-semibold uppercase mb-2 tracking-wider flex items-center gap-2" style={{ color: profile.color }}>
               Active Policy
             </h3>
             <p className="text-sm font-bold text-slate-200">{profile.name}</p>
             <p className="text-xs text-slate-400 mb-4 h-8">{profile.desc}</p>
             
             <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center p-2 rounded bg-slate-950/50">
                   <span className="text-blue-400">α (Dampening)</span>
                   <span className="text-slate-300">+{profile.alpha.dampening_strength*100}%</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-slate-950/50">
                   <span className="text-purple-400">β (Activation T.)</span>
                   <span className="text-slate-300">dT/dP {'>'} {profile.beta.responsiveness_threshold}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-slate-950/50">
                   <span className="text-red-400">γ (Halt T.)</span>
                   <span className="text-slate-300">E {'<'} {profile.gamma.halt_threshold}</span>
                </div>
             </div>
          </div>

          {/* System Control */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
             <h3 className="text-xs font-semibold uppercase text-slate-500 mb-4">L1/L2 Base Environment</h3>
             <div className="space-y-4">
               <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Formation Energy (F)</span> <span>{params.formationEnergy.toFixed(2)}</span>
                  </div>
                  <input type="range" name="formationEnergy" min={0.1} max={3.0} step={0.1} value={params.formationEnergy} onChange={handleParamChange} className="w-full accent-slate-500 h-1 bg-slate-800 rounded-lg appearance-none" />
               </div>
               <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Attractor Strength (A)</span> <span>{params.attractorStrength.toFixed(2)}</span>
                  </div>
                  <input type="range" name="attractorStrength" min={0.0} max={3.0} step={0.1} value={params.attractorStrength} onChange={handleParamChange} className="w-full accent-slate-500 h-1 bg-slate-800 rounded-lg appearance-none" />
               </div>
               <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Op. Constraint (O)</span> <span>{params.opConstraint.toFixed(2)}</span>
                  </div>
                  <input type="range" name="opConstraint" min={0.0} max={1.5} step={0.05} value={params.opConstraint} onChange={handleParamChange} className="w-full accent-slate-500 h-1 bg-slate-800 rounded-lg appearance-none" />
               </div>
             </div>
             
             <button onClick={() => setPerturbation(15.0)} className="mt-4 w-full py-2 bg-yellow-900/30 hover:bg-yellow-800/40 border border-yellow-700/50 text-yellow-500 rounded text-sm font-medium transition-colors flex justify-center gap-2">
               <Zap size={16}/> Inject Chaos
             </button>
          </div>
        </div>

        {/* RIGHT COLUMN: CHARTS */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Main Status Bar */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 flex justify-between items-center shadow-lg" style={{ borderLeftColor: activeColor, borderLeftWidth: '4px' }}>
             <div className="flex items-center gap-3">
                {current.state.includes('HALT') ? <AlertTriangle className="text-red-500 animate-pulse"/> : <Activity style={{color: activeColor}}/>}
                <span className="font-bold text-lg" style={{color: activeColor}}>{current.state}</span>
             </div>
             <div className="flex gap-4 font-mono text-xs text-slate-400">
                <span className={current.E < profile.gamma.halt_threshold ? 'text-red-400' : ''}>E: {current.E.toFixed(2)}</span>
                <span className={current.dT_dP <= profile.beta.responsiveness_threshold ? 'text-red-400' : ''}>dT/dP: {current.dT_dP.toFixed(2)}</span>
             </div>
          </div>

          {/* Top Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64">
             {/* Viability B(t) */}
             <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 h-full flex flex-col">
                <h3 className="text-xs font-semibold text-slate-400 mb-2">Viability Balance B(t)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tick={false} axisLine={false} />
                    <YAxis domain={[0, 1]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                    {/* @ts-ignore */}
                    <ReferenceArea y1={0} y2={params.eps_min} fill="#ef4444" fillOpacity={0.1} />
                    {/* @ts-ignore */}
                    <ReferenceArea y1={params.eps_max} y2={1} fill="#f59e0b" fillOpacity={0.1} />
                    <Line type="monotone" dataKey="B" stroke={activeColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
             </div>

             {/* Control Signal u(t) */}
             <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 h-full flex flex-col">
                <div className="flex justify-between items-start mb-2">
                   <h3 className="text-xs font-semibold text-slate-400">Counterforce u(t)</h3>
                   <span className="text-[9px] font-mono text-blue-400 px-1.5 py-0.5 bg-blue-950/50 rounded">α mod: +{profile.alpha.dampening_strength*100}%</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tick={false} axisLine={false} />
                    <YAxis domain={[-3, 3]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Bar dataKey="u" isAnimationActive={false}>
                      {history.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.state.includes('HALT') ? '#1e293b' : (entry.u > 0 ? '#3b82f6' : '#ef4444')} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Bottom Chart: Phase Space (E vs dT_dP) -> Showing Gamma and Beta thresholds */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 h-64 flex flex-col">
             <h3 className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-2">
                Boundary Space <span className="font-mono text-[10px] text-slate-500">(Elasticity vs Responsiveness)</span>
             </h3>
             <ResponsiveContainer width="100%" height="100%">
               <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                 <XAxis dataKey="dT_dP" type="number" domain={[0, 1.2]} name="Responsiveness" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'dT/dP (β)', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 10 }} />
                 <YAxis dataKey="E" type="number" domain={[0, 1.2]} name="Elasticity" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'E Field (γ)', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 10 }} />
                 <ZAxis range={[20, 20]} />
                 
                 {/* Beta Threshold Line (Vertical) */}
                 {/* @ts-ignore */}
                 <ReferenceArea x1={0} x2={profile.beta.responsiveness_threshold} fill="#64748b" fillOpacity={0.2} />
                 
                 {/* Gamma Threshold Line (Horizontal) */}
                 {/* @ts-ignore */}
                 <ReferenceArea y1={0} y2={profile.gamma.halt_threshold} fill="#ef4444" fillOpacity={0.15} />

                 {/* Current trajectory path */}
                 <Scatter data={history.map((h, i) => ({ dT_dP: h.dT_dP, E: h.E, opacity: (i+1)/history.length }))} fill={profile.color} shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    return <circle cx={cx} cy={cy} r={3} fill={profile.color} opacity={payload.opacity} />;
                 }} isAnimationActive={false} />
               </ScatterChart>
             </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}
