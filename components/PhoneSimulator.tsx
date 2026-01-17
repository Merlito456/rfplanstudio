
import React, { useMemo } from 'react';
import { Crosshair, AlertTriangle, CheckCircle2, Info, Activity } from 'lucide-react';
import { PhoneDeviceState } from '../types';
import * as L from 'leaflet';

interface Props {
  state: PhoneDeviceState;
  map: L.Map;
  mapVersion: number;
}

const PhoneSimulator: React.FC<Props> = ({ state, map, mapVersion }) => {
  const point = map.latLngToContainerPoint([state.lat, state.lng]);

  const analysis = useMemo(() => {
    let remarks = "Optimal connection.";
    let effects = "Stable 4K streaming.";
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (state.rsrp < -115) {
      remarks = "No Service.";
      effects = "Connection dropped.";
      severity = 'critical';
    } else if (state.rsrp < -105) {
      remarks = "Weak Signal.";
      effects = "Packet loss, battery drain.";
      severity = 'high';
    } else if (state.sinr < 5) {
      remarks = "High Interference.";
      effects = "Throughput reduced.";
      severity = 'medium';
    } else if (state.rsrp < -90) {
      remarks = "Fair Coverage.";
      effects = "Standard HD quality.";
      severity = 'low';
    }

    return { remarks, effects, severity };
  }, [state.rsrp, state.sinr]);

  const severityColor = {
    low: 'text-emerald-500 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-500 bg-amber-50 border-amber-200',
    high: 'text-orange-500 bg-orange-50 border-orange-200',
    critical: 'text-red-500 bg-red-50 border-red-200'
  }[analysis.severity];

  return (
    <div className="absolute inset-0 pointer-events-none z-[1001]">
      <div 
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
        style={{ left: point.x, top: point.y }}
      >
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-4 border-white shadow-2xl flex items-center justify-center bg-slate-900 transition-transform duration-300">
           <Crosshair size={20} className="text-blue-400" />
           <div className="absolute -inset-2 rounded-full border border-blue-400/30 animate-ping opacity-20"></div>
        </div>

        {/* Info Panel: Anchored to probe on desktop, bottom-centered on mobile */}
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:absolute md:top-0 md:left-16 md:translate-x-0 w-[90vw] max-w-[320px] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-[2rem] shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
               <Activity size={14} className="text-blue-600" />
               <span className="text-[9px] font-black uppercase text-blue-600 tracking-widest">Signal Intelligence</span>
            </div>
            <span className="text-[8px] font-mono text-slate-400">{state.lat.toFixed(4)}, {state.lng.toFixed(4)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
             <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 text-center">
                <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">RSRP (Strength)</div>
                <div className={`text-xl font-black ${state.rsrp > -90 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(state.rsrp)} <span className="text-[10px]">dBm</span></div>
             </div>
             <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 text-center">
                <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">SINR (Quality)</div>
                <div className={`text-xl font-black ${state.sinr > 12 ? 'text-emerald-500' : 'text-blue-500'}`}>{Math.round(state.sinr)} <span className="text-[10px]">dB</span></div>
             </div>
          </div>

          <div className={`p-3 rounded-2xl border flex items-start gap-2 ${severityColor} transition-colors`}>
            {analysis.severity === 'low' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <div>
                <div className="text-[10px] font-black uppercase tracking-tight mb-0.5">{analysis.remarks}</div>
                <div className="text-[9px] font-medium opacity-80">{analysis.effects}</div>
            </div>
          </div>
          
          <div className="bg-blue-50/30 p-2.5 rounded-2xl border border-blue-100/50 flex items-center justify-between">
            <div className="flex flex-col">
                <span className="text-[7px] font-black text-blue-400 uppercase tracking-tighter">Connected Node</span>
                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[140px]">{state.servingSiteName || 'Searching...'}</span>
            </div>
            <span className="text-[8px] font-mono text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded-full uppercase shrink-0 border border-blue-200">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneSimulator;
