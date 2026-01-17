
import React from 'react';
import { Smartphone, Info, TowerControl as TowerIcon, Target } from 'lucide-react';

interface Props {
  showSimulator: boolean;
}

const Legend: React.FC<Props> = ({ showSimulator }) => {
  return (
    <div className="absolute bottom-20 md:bottom-8 right-4 md:right-8 z-[600] pointer-events-none">
      <div className="bg-white/95 backdrop-blur-lg border border-slate-100 p-4 rounded-[2rem] shadow-2xl w-48 md:w-56 space-y-4 pointer-events-auto">
        <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2">
          <Info size={12} className="text-blue-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">RSRP Intensity (dBm)</span>
        </div>

        <div className="space-y-1">
          <div className="relative h-3 w-full flex rounded-sm overflow-hidden border border-slate-100">
            <div className="w-[20%] bg-[#dc2626]" title="-115 to -105"></div>
            <div className="w-[20%] bg-[#f97316]" title="-105 to -95"></div>
            <div className="w-[20%] bg-[#eab308]" title="-95 to -85"></div>
            <div className="w-[20%] bg-[#22c55e]" title="-85 to -75"></div>
            <div className="w-[20%] bg-[#00b4ff]" title="> -75"></div>
          </div>
          <div className="flex justify-between text-[7px] font-black uppercase tracking-tighter opacity-60">
             <span>Critical (-115)</span>
             <span>Excellent (-75)</span>
          </div>
        </div>

        <div className="space-y-2 pt-1 border-t border-slate-50">
          <div className="flex items-center gap-2.5">
            <TowerIcon size={14} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-700">Service Node</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Target size={14} className="text-amber-500" />
            <span className="text-[10px] font-bold text-slate-700">Capacity Gap</span>
          </div>
          {showSimulator && (
            <div className="flex items-center gap-2.5">
              <Smartphone size={14} className="text-blue-600" />
              <span className="text-[10px] font-bold text-slate-700">UE Probe</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Legend;
