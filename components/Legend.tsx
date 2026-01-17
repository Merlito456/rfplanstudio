
import React from 'react';
import { Smartphone, Info, TowerControl as TowerIcon, Target } from 'lucide-react';

interface Props {
  showSimulator: boolean;
}

const Legend: React.FC<Props> = ({ showSimulator }) => {
  return (
    <div className="absolute bottom-20 md:bottom-6 right-4 md:right-6 z-[600] animate-in slide-in-from-bottom-4 duration-500 max-w-[200px] md:max-w-none pointer-events-none">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3 md:p-4 rounded-[1.2rem] md:rounded-[1.5rem] shadow-xl w-44 md:w-64 space-y-3 md:space-y-4 pointer-events-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Info size={10} className="text-blue-600" />
            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-800">RF Spectrum</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="relative h-2 w-full flex rounded-full overflow-hidden border border-slate-100">
            <div className="w-[20%] bg-red-600"></div>
            <div className="w-[20%] bg-orange-500"></div>
            <div className="w-[20%] bg-yellow-500"></div>
            <div className="w-[20%] bg-lime-500"></div>
            <div className="w-[20%] bg-green-500"></div>
          </div>
          <div className="flex justify-between text-[7px] md:text-[8px] font-black uppercase tracking-tighter opacity-70">
             <span className="text-slate-500">Poor (-115)</span>
             <span className="text-slate-500">Ex (-75)</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-slate-100 rounded-md"><TowerIcon size={12} className="text-slate-500" /></div>
            <span className="text-[9px] font-bold text-slate-700">Tower Hub</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1 bg-amber-50 rounded-md"><Target size={12} className="text-amber-500" /></div>
            <span className="text-[9px] font-bold text-slate-700">AI Spot</span>
          </div>
          {showSimulator && (
            <div className="flex items-center gap-2">
              <div className="p-1 bg-blue-50 rounded-md"><Smartphone size={12} className="text-blue-600" /></div>
              <span className="text-[9px] font-bold text-slate-700">Active Probe</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Legend;
