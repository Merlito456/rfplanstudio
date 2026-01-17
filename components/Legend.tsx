
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
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">RF Spectrum</span>
        </div>

        <div className="space-y-1.5">
          <div className="relative h-2 w-full flex rounded-full overflow-hidden">
            <div className="w-[20%] bg-red-600"></div>
            <div className="w-[20%] bg-orange-500"></div>
            <div className="w-[20%] bg-yellow-500"></div>
            <div className="w-[20%] bg-lime-500"></div>
            <div className="w-[20%] bg-green-500"></div>
          </div>
          <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter opacity-50">
             <span>POOR (-115)</span>
             <span>EX (-75)</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2.5">
            <TowerIcon size={14} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-700">Tower Hub</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Target size={14} className="text-amber-500" />
            <span className="text-[10px] font-bold text-slate-700">AI Spot</span>
          </div>
          {showSimulator && (
            <div className="flex items-center gap-2.5">
              <Smartphone size={14} className="text-blue-600" />
              <span className="text-[10px] font-bold text-slate-700">Active Probe</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Legend;
