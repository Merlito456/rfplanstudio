
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
  // Re-calculate screen position on every mapVersion change (move/zoom)
  const point = map.latLngToContainerPoint([state.lat, state.lng]);

  const analysis = useMemo(() => {
    let remarks = "Optimal connection.";
    let effects = "High-speed data, ultra-low latency, stable 4K streaming.";
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (state.rsrp < -115) {
      remarks = "No Service / Out of range.";
      effects = "Connection dropped. Unable to initiate calls or data sessions.";
      severity = 'critical';
    } else if (state.rsrp < -105) {
      remarks = "Weak Signal / Cell Edge.";
      effects = "High packet loss, intermittent drops, battery drain due to TX power ramp.";
      severity = 'high';
    } else if (state.sinr < 5) {
      remarks = "High Interference (Pilot Pollution).";
      effects = "Throughput reduced by up to 80%. High retransmission rate.";
      severity = 'medium';
    } else if (state.rsrp < -90) {
      remarks = "Fair Coverage.";
      effects = "Occasional buffering in HD video. Standard voice quality.";
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
      {/* Probe Point UI */}
      <div 
        className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-auto will-change-transform"
        style={{ left: point.x, top: point.y }}
      >
        <div className={`w-12 h-12 rounded-full border-4 border-white shadow-2xl flex items-center justify-center bg-slate-900 group`}>
           <Crosshair size={24} className="text-blue-400 group-hover:scale-125 transition-transform" />
           <div className="absolute -inset-2 rounded-full border border-blue-400/30 animate-ping opacity-20"></div>
        </div>

        {/* Detailed Info Panel */}
        <div className="absolute top-0 left-16 w-[320px] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
               <Activity size={16} className="text-blue-600" />
               <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Signal Analysis</span>
            </div>
            <span className="text-[8px] font-mono text-slate-400">{state.lat.toFixed(5)}, {state.lng.toFixed(5)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">RSRP</div>
                <div className={`text-2xl font-black ${state.rsrp > -85 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(state.rsrp)} <span className="text-xs">dBm</span></div>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">SINR</div>
                <div className={`text-2xl font-black ${state.sinr > 15 ? 'text-emerald-500' : 'text-blue-500'}`}>{Math.round(state.sinr)} <span className="text-xs">dB</span></div>
             </div>
          </div>

          <div className="space-y-3">
             <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${severityColor}`}>
                {analysis.severity === 'low' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                <div className="space-y-1">
                   <div className="text-[10px] font-black uppercase tracking-tight">Technical Remarks</div>
                   <div className="text-[11px] font-bold leading-tight">{analysis.remarks}</div>
                </div>
             </div>

             <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 flex items-start gap-3">
                <Info size={18} className="shrink-0 mt-0.5 text-blue-400" />
                <div className="space-y-1">
                   <div className="text-[10px] font-black uppercase tracking-tight text-blue-400">Network Effects</div>
                   <div className="text-[11px] font-medium leading-tight opacity-90">{analysis.effects}</div>
                </div>
             </div>
          </div>

          <div className="pt-2">
             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Serving Cell</div>
             <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{state.servingSiteName || 'N/A'}</span>
                <span className="text-[10px] font-mono text-blue-600 bg-blue-100 px-2 py-0.5 rounded uppercase">Connected</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneSimulator;
