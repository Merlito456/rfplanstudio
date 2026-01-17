
import React, { useState } from 'react';
import { Site, TowerType, Sector } from '../types';
import { ANTENNA_LIBRARY, TOWER_TYPES } from '../constants';
import { optimizeSiteParameters } from '../services/rfEngine';
import { Trash2, Plus, Zap, Layers, Ruler, Sparkles, Loader2, Save } from 'lucide-react';

interface Props {
  site: Site;
  allSites: Site[];
  onUpdate: (site: Site) => void;
  onDelete: () => void;
}

const SiteDetails: React.FC<Props> = ({ site, allSites, onUpdate, onDelete }) => {
  const [isOptimizing, setIsOptimizing] = useState(false);

  const addSector = () => {
    const newSector: Sector = {
      id: crypto.randomUUID(),
      antennaId: ANTENNA_LIBRARY[0].id,
      azimuth: 0,
      mechanicalTilt: 0,
      electricalTilt: 0,
      txPowerDbm: 43,
      frequencyMhz: 1800,
      heightM: site.towerHeightM - 2
    };
    onUpdate({ ...site, sectors: [...site.sectors, newSector] });
  };

  const handleAIOptimize = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const optimizedSectors = optimizeSiteParameters(site, allSites, true);
      onUpdate({ ...site, sectors: optimizedSectors });
      setIsOptimizing(false);
    }, 1200);
  };

  const removeSector = (id: string) => {
    onUpdate({ ...site, sectors: site.sectors.filter(s => s.id !== id) });
  };

  const updateSector = (id: string, updates: Partial<Sector>) => {
    onUpdate({
      ...site,
      sectors: site.sectors.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Site Config</h3>
        <button 
          onClick={onDelete} 
          className="text-slate-400 hover:text-red-600 p-2 transition-colors rounded-lg hover:bg-red-50"
          title="Delete Site"
        >
          <Trash2 size={24} />
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-6 space-y-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Project Name</label>
            <input 
              type="text" 
              value={site.name}
              onChange={(e) => onUpdate({ ...site, name: e.target.value })}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Structure Type</label>
            <select 
              value={site.towerType}
              onChange={(e) => onUpdate({ ...site, towerType: e.target.value as TowerType })}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:border-blue-500 outline-none transition-all"
            >
              {TOWER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Twr Height (m)</label>
            <div className="relative">
              <input 
                type="number" 
                value={site.towerHeightM}
                onChange={(e) => onUpdate({ ...site, towerHeightM: Number(e.target.value) })}
                className="w-full border-2 border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold text-slate-800 focus:border-blue-500 outline-none transition-all"
              />
              <Ruler className="absolute right-3 top-3 text-slate-300" size={16} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pb-10">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <h4 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Layers size={20} className="text-blue-600" />
            Sectors
          </h4>
          <div className="flex gap-2">
            <button 
              onClick={handleAIOptimize}
              disabled={isOptimizing || site.sectors.length === 0}
              className="flex-grow md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase hover:bg-emerald-500 transition shadow-lg disabled:opacity-50"
            >
              {isOptimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              AI Opt
            </button>
            <button 
              onClick={addSector}
              className="flex-grow md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 transition shadow-lg"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {site.sectors.map((sector, idx) => (
            <div key={sector.id} className="border-2 border-slate-100 rounded-2xl p-4 md:p-6 bg-white shadow-sm relative hover:border-blue-100 transition-colors group">
              <button 
                onClick={() => removeSector(sector.id)}
                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                  {idx + 1}
                </div>
                <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">RF Configuration</div>
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Antenna Model</label>
                  <select 
                    value={sector.antennaId}
                    onChange={(e) => updateSector(sector.id, { antennaId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold bg-slate-50 text-slate-800 focus:border-blue-500 outline-none"
                  >
                    {ANTENNA_LIBRARY.map(a => (
                      <option key={a.id} value={a.id}>{a.vendor} - {a.model}</option>
                    ))}
                  </select>
                </div>
                
                <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Azimuth (°)</label>
                  <input type="number" value={sector.azimuth} onChange={(e) => updateSector(sector.id, { azimuth: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none" />
                </div>
                <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mount Ht (m)</label>
                  <input type="number" value={sector.heightM} onChange={(e) => updateSector(sector.id, { heightM: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none" />
                </div>
                <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mech Tilt (°)</label>
                  <input type="number" value={sector.mechanicalTilt} onChange={(e) => updateSector(sector.id, { mechanicalTilt: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none" />
                </div>
                <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Elec Tilt (°)</label>
                  <input type="number" value={sector.electricalTilt} onChange={(e) => updateSector(sector.id, { electricalTilt: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SiteDetails;
