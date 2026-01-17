
import React from 'react';
import { Smartphone, Info, TowerControl as TowerIcon, Target } from 'lucide-react';

interface Props {
  showSimulator: boolean;
}

const Legend: React.FC<Props> = ({ showSimulator }) => {
  return (
    <div className="absolute bottom-6 right-6 z-[600] animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-4 rounded-[1.5rem] shadow-xl w-64 space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Info size={12} className="text-blue-600" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-800">Legend</span>
          </div>
          <div className="text-[8px] font-bold text-slate-400 uppercase">RSRP (dBm)</div>
        </div>

        {/* Compressed Signal Scale */}
        <div className="space-y-2">
          <div className="relative h-3 w-full flex rounded-full overflow-hidden border border-slate-100 shadow-inner">
            <div className="w-[15%] bg-red-600" title="No Service"></div>
            <div className="w-[15%] bg-orange-500" title="Poor"></div>
            <div className="w-[20%] bg-yellow-500" title="Fair"></div>
            <div className="w-[25%] bg-lime-500" title="Good"></div>
            <div className="w-[25%] bg-green-500" title="Excellent"></div>
          </div>
          
          <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter">
             <span className="text-red-600">-115</span>
             <span className="text-slate-400">Fair</span>
             <span className="text-green-600">-75+</span>
          </div>
        </div>

        {/* Condensed Symbol List */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
              <TowerIcon size={14} className="text-slate-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-800 leading-none">Macro Hub</span>
              <span className="text-[8px] font-medium text-slate-400 uppercase">Tower Site</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Target size={14} className="text-amber-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-amber-700 leading-none">AI Suggestion</span>
              <span className="text-[8px] font-medium text-amber-400 uppercase">Coverage Gap</span>
            </div>
          </div>

          {showSimulator && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center animate-pulse">
                <Smartphone size={14} className="text-blue-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-blue-700 leading-none">Active Probe</span>
                <span className="text-[8px] font-medium text-blue-400 uppercase">Center Center</span>
              </div>
            </div>
          )}
        </div>

        {/* Minimal Engine Note */}
        <div className="text-[8px] text-slate-400 font-medium italic text-center border-t border-slate-50 pt-2">
          Terrain-aware Knife-edge Prop.
        </div>
      </div>
    </div>
  );
};

export default Legend;
