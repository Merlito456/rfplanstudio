
import React from 'react';
import { Smartphone, Info, TowerControl as TowerIcon, Target } from 'lucide-react';

interface Props {
  showSimulator: boolean;
}

const Legend: React.FC<Props> = ({ showSimulator }) => {
  return (
    <div className="absolute bottom-20 md:bottom-6 right-4 md:right-6 z-[600] animate-in slide-in-from-bottom-4 duration-500 max-w-[200px] md:max-w-none">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3 md:p-4 rounded-[1.2rem] md:rounded-[1.5rem] shadow-xl w-48 md:w-64 space-y-3 md:space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Info size={10} className="text-blue-600" />
            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-800">Legend</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="relative h-2.5 w-full flex rounded-full overflow-hidden border border-slate-100">
            <div className="w-[20%] bg-red-600"></div>
            <div className="w-[20%] bg-orange-500"></div>
            <div className="w-[20%] bg-yellow-500"></div>
            <div className="w-[20%] bg-lime-500"></div>
            <div className="w-[20%] bg-green-500"></div>
          </div>
          <div className="flex justify-between text-[7px] md:text-[8px] font-black uppercase tracking-tighter">
             <span className="text-red-600">-115</span>
             <span className="text-green-600">-75+</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <TowerIcon size={12} className="text-slate-500" />
            <span className="text-[9px] font-bold text-slate-800">Tower Site</span>
          </div>
          <div className="flex items-center gap-2">
            <Target size={12} className="text-amber-500" />
            <span className="text-[9px] font-bold text-slate-800">AI Suggestion</span>
          </div>
          {showSimulator && (
            <div className="flex items-center gap-2">
              <Smartphone size={12} className="text-blue-600" />
              <span className="text-[9px] font-bold text-slate-800">Active Probe</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Legend;
