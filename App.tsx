
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Site, CoveragePoint, ChatMessage, TowerType, PhoneDeviceState, Sector, ProjectComment, RFProject } from './types';
import { ANTENNA_LIBRARY, DEFAULT_SITE } from './constants';
import { findOptimalNextSites, getPhoneSignalProfile } from './services/rfEngine';
import { getRFAdvice } from './services/geminiService';
import SiteDetails from './components/SiteDetails';
import Heatmap from './components/Heatmap';
import PhoneSimulator from './components/PhoneSimulator';
import Legend from './components/Legend';
import TrafficMap from './components/TrafficMap';
import * as L from 'leaflet';
import { 
  Map as MapIcon, 
  BookOpen, 
  Cpu, 
  PlusCircle, 
  Maximize2, 
  BarChart2, 
  Search, 
  Radio, 
  Send, 
  Loader2, 
  TowerControl as TowerIcon, 
  Landmark,
  Target,
  MessageSquare,
  History,
  X,
  Crosshair,
  Zap,
  Trash2,
  RefreshCcw,
  Sparkles,
  Activity
} from 'lucide-react';

const STORAGE_KEY = 'rf_plan_studio_current_project_v3';

// WEB WORKER SOURCE (Offloading heavy math)
const workerCode = `
  self.importScripts('https://esm.sh/@google/genai@^1.37.0'); 
  // Note: We'll inline required math here for complete isolation
  const LIGHT_SPEED = 299792458;
  const EARTH_RADIUS_KM = 6371;

  const calculateHata = (distKm, freqMhz, hb, hm) => {
    if (distKm < 0.01) return 32.44 + 20 * Math.log10(distKm || 0.01) + 20 * Math.log10(freqMhz);
    const logF = Math.log10(freqMhz), logHb = Math.log10(hb);
    const aHm = (1.1 * logF - 0.7) * hm - (1.56 * logF - 0.8);
    return 69.55 + 26.16 * logF - 13.82 * logHb - aHm + (44.9 - 6.55 * logHb) * Math.log10(distKm);
  };

  self.onmessage = function(e) {
    const { sites, antennaLibrary, config } = e.data;
    const points = [];
    if (!sites.length) { self.postMessage([]); return; }

    const lats = sites.map(s => s.lat), lngs = sites.map(s => s.lng);
    const minLat = Math.min(...lats) - 0.1, maxLat = Math.max(...lats) + 0.1;
    const minLng = Math.min(...lngs) - 0.1, maxLng = Math.max(...lngs) + 0.1;
    const step = config.step || 0.0003;

    for (let lat = minLat; lat <= maxLat; lat += step) {
      for (let lng = minLng; lng <= maxLng; lng += step) {
        let bestRsrp = -150;
        for (const site of sites) {
          const dLat = (lat - site.lat) * (Math.PI / 180);
          const dLng = (lng - site.lng) * (Math.PI / 180);
          const a = Math.sin(dLat/2) ** 2 + Math.cos(site.lat * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2) ** 2;
          const distKm = EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          if (distKm > 10) continue;
          
          for (const sector of site.sectors) {
            const loss = calculateHata(distKm, sector.frequencyMhz, sector.heightM || site.towerHeightM, 1.5);
            const ant = antennaLibrary.find(al => al.id === sector.antennaId);
            const rsrp = (sector.txPowerDbm || 43) + (ant ? ant.gainDbi : 17) - loss;
            if (rsrp > bestRsrp) bestRsrp = rsrp;
          }
        }
        if (bestRsrp > -120) points.push({ lat, lng, rsrp: bestRsrp });
      }
    }
    self.postMessage(points);
  };
`;

const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [projectName, setProjectName] = useState('New RF Project');
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'library' | 'ai' | 'analytics'>('map');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedSites, setSuggestedSites] = useState<any[]>([]);
  const [coveragePoints, setCoveragePoints] = useState<CoveragePoint[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'model', text: "Engineering core active. Multi-threaded spatial engine initialized." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [mapType, setMapType] = useState<'map' | 'satellite'>('map');
  const [interactionMode, setInteractionMode] = useState<'none' | 'placement' | 'probe' | 'comment' | 'traffic'>('none');
  const [probeLocation, setProbeLocation] = useState<{lat: number, lng: number} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enableTerrain, setEnableTerrain] = useState(true);
  const [mapVersion, setMapVersion] = useState(0);

  const [phoneState, setPhoneState] = useState<PhoneDeviceState>({
    lat: 40.7128, lng: -74.006, rsrp: -140, sinr: -20, servingCellId: null, servingSiteName: null, neighbors: [], handoverCount: 0, lastHandoverTime: null
  });

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const simulationWorker = useRef<Worker | null>(null);

  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    simulationWorker.current = new Worker(URL.createObjectURL(blob));
    simulationWorker.current.onmessage = (e) => {
      setCoveragePoints(e.data);
      setIsSimulating(false);
    };
    return () => simulationWorker.current?.terminate();
  }, []);

  // Persistence
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const project: RFProject = JSON.parse(raw);
        setSites(project.sites || []);
        setComments(project.comments || []);
        setProjectName(project.name || 'New RF Project');
      } catch (e) { console.error("Load failed", e); }
    }
  }, []);

  useEffect(() => {
    if (sites.length > 0 || comments.length > 0) {
      const project: RFProject = { name: projectName, sites, comments, lastSaved: Date.now(), version: '3.0' };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setLastSaved(project.lastSaved);
    }
  }, [sites, comments, projectName]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false, maxZoom: 19, trackResize: true }).setView([40.7128, -74.006], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    setMapInstance(map);
    map.on('move zoom resize', () => setMapVersion(v => v + 1));
    return () => { map.remove(); setMapInstance(null); };
  }, []);

  useEffect(() => {
    if (interactionMode === 'probe' && probeLocation) {
      const profile = getPhoneSignalProfile(sites, probeLocation.lat, probeLocation.lng, enableTerrain);
      setPhoneState(prev => ({ ...prev, ...profile }));
    }
  }, [sites, enableTerrain, interactionMode, probeLocation, mapVersion]);

  useEffect(() => {
    if (!mapInstance) return;
    if (baseLayerRef.current) mapInstance.removeLayer(baseLayerRef.current);
    const topoUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
    const satUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    baseLayerRef.current = L.tileLayer(mapType === 'satellite' ? satUrl : topoUrl, { maxZoom: 19 }).addTo(mapInstance);
    baseLayerRef.current.bringToBack();
  }, [mapType, mapInstance]);

  const deploySite = (lat: number, lng: number, config?: any) => {
    const newSite: Site = { ...DEFAULT_SITE, id: crypto.randomUUID(), name: config?.name || `Site ${sites.length + 1}`, lat, lng, sectors: config?.sectors?.length ? config.sectors : [] };
    setSites(prev => [...prev, newSite]);
    setSelectedSiteId(newSite.id);
    setInteractionMode('none');
    setSuggestedSites(prev => prev.filter(s => Math.abs(s.lat - lat) > 0.0001));
  };

  const handleAISuggestSite = () => {
    if (sites.length === 0) { alert("Deploy at least one initial site."); return; }
    if (suggestedSites.length > 0) { setSuggestedSites([]); return; }
    setIsSuggesting(true);
    setTimeout(() => {
      const holes = findOptimalNextSites(sites);
      setSuggestedSites(holes.map((h, i) => ({ ...h, name: `Node Expansion ${i + 1}` })));
      setIsSuggesting(false);
      if (holes.length > 0 && mapInstance) mapInstance.flyTo([holes[0].lat, holes[0].lng], mapInstance.getZoom());
    }, 500);
  };

  const startSimulation = () => {
    if (sites.length === 0) return;
    setIsSimulating(true);
    const step = sites.length > 30 ? 0.0008 : 0.0004;
    simulationWorker.current?.postMessage({ sites, antennaLibrary: ANTENNA_LIBRARY, config: { step, useTerrain: enableTerrain } });
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const input = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', text: input }]);
    setChatInput('');
    const response = await getRFAdvice(sites, input);
    setChatHistory(prev => [...prev, { role: 'model', text: response }]);
  };

  const selectedSite = useMemo(() => sites.find(s => s.id === selectedSiteId), [sites, selectedSiteId]);

  return (
    <div className="flex h-screen w-screen bg-white text-slate-900 font-sans overflow-hidden">
      <nav className="flex flex-col w-16 h-full bg-white border-r border-slate-100 items-center py-6 z-[1002] space-y-4 shrink-0">
        <div className="text-blue-600 font-black text-xl mb-6">RF</div>
        {[{ id: 'map', icon: MapIcon }, { id: 'library', icon: BookOpen }, { id: 'analytics', icon: BarChart2 }, { id: 'ai', icon: Cpu }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'}`}><tab.icon size={20} /></button>
        ))}
        <div className="flex-grow" />
        <button onClick={() => { if(confirm("Clear project?")) { setSites([]); setComments([]); setCoveragePoints([]); localStorage.removeItem(STORAGE_KEY); } }} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500"><RefreshCcw size={20} /></button>
      </nav>

      <main className="flex-grow flex flex-col relative h-full overflow-hidden">
        <header className="flex h-16 items-center justify-between px-6 bg-white border-b border-slate-100 z-[1000] shrink-0">
          <div className="flex flex-col min-w-[200px]">
            <input value={projectName} onChange={e => setProjectName(e.target.value)} className="text-sm font-extrabold text-slate-800 bg-transparent border-none outline-none p-0" />
            <div className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5"><History size={10} /> {new Date(lastSaved).toLocaleTimeString()}</div>
          </div>
          <div className="flex items-center gap-4 justify-end">
            <div className="flex bg-slate-100 p-1 rounded-full border">
              <button onClick={() => setMapType('map')} className={`px-4 py-1 rounded-full text-[9px] font-black uppercase ${mapType === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Map</button>
              <button onClick={() => setMapType('satellite')} className={`px-4 py-1 rounded-full text-[9px] font-black uppercase ${mapType === 'satellite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Sat</button>
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'terrain', icon: Landmark, action: () => setEnableTerrain(!enableTerrain), active: enableTerrain, label: 'Terrain' },
                { id: 'suggest', icon: Target, action: handleAISuggestSite, active: isSuggesting || suggestedSites.length > 0, label: 'Smart Optimization', loading: isSuggesting },
                { id: 'traffic', icon: Activity, action: () => setInteractionMode(interactionMode === 'traffic' ? 'none' : 'traffic'), active: interactionMode === 'traffic', label: 'Load Map' },
                { id: 'probe', icon: Crosshair, action: () => setInteractionMode(interactionMode === 'probe' ? 'none' : 'probe'), active: interactionMode === 'probe', label: 'Probe' }
              ].map(tool => (
                <button key={tool.id} onClick={tool.action} className={`w-9 h-9 rounded-full border flex items-center justify-center relative ${tool.active ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white text-slate-400 hover:border-slate-300'}`}>
                  {tool.loading ? <Loader2 size={16} className="animate-spin" /> : <tool.icon size={16} />}
                  {tool.id === 'suggest' && suggestedSites.length > 0 && !isSuggesting && <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white" />}
                </button>
              ))}
            </div>
            <button onClick={startSimulation} disabled={isSimulating || sites.length === 0} className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50">
              {isSimulating ? <Loader2 size={14} className="animate-spin" /> : <Maximize2 size={14} />} SCAN
            </button>
            <button onClick={() => setInteractionMode(interactionMode === 'placement' ? 'none' : 'placement')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md ${interactionMode === 'placement' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>DEPLOY</button>
          </div>
        </header>

        <div className="flex-grow relative w-full h-full bg-slate-50 overflow-hidden">
          <div className={`absolute inset-0 z-0 ${activeTab === 'map' ? 'visible' : 'invisible pointer-events-none'}`}>
            <div ref={mapContainerRef} className="w-full h-full" />
            <Heatmap points={coveragePoints} map={mapInstance} />
            {interactionMode === 'traffic' && <TrafficMap map={mapInstance} />}
            {interactionMode === 'probe' && probeLocation && mapInstance && <PhoneSimulator state={phoneState} map={mapInstance} mapVersion={mapVersion} />}
            <div className="absolute inset-0 pointer-events-none z-[500]">
               {mapInstance && sites.map(site => {
                  const pt = mapInstance.latLngToContainerPoint([site.lat, site.lng]);
                  return <div key={site.id} onClick={(e) => { e.stopPropagation(); setSelectedSiteId(site.id); }} className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-110" style={{ left: pt.x, top: pt.y }}><div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center ${selectedSiteId === site.id ? 'bg-blue-600 border-white shadow-xl' : 'bg-white border-slate-300 shadow-sm'}`}><TowerIcon size={14} className={selectedSiteId === site.id ? 'text-white' : 'text-slate-500'} /></div></div>;
               })}
               {mapInstance && suggestedSites.map((s, idx) => {
                  const pt = mapInstance.latLngToContainerPoint([s.lat, s.lng]);
                  return <div key={`sug-${idx}`} onClick={(e) => { e.stopPropagation(); deploySite(s.lat, s.lng, s); }} className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 group cursor-pointer" style={{ left: pt.x, top: pt.y }}><div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white animate-pulse"><Sparkles size={14} /></div></div>;
               })}
            </div>
            <Legend showSimulator={interactionMode === 'probe' && !!probeLocation} />
          </div>

          {activeTab !== 'map' && (
            <div className="absolute inset-0 bg-white z-[1001] overflow-y-auto p-12 animate-in fade-in duration-300">
              <div className="max-w-6xl mx-auto">
                {activeTab === 'library' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{ANTENNA_LIBRARY.map(ant => (<div key={ant.id} className="p-6 border rounded-3xl hover:border-blue-500 transition-all bg-white"><h3 className="text-lg font-black text-slate-800">{ant.model}</h3><p className="text-[10px] font-bold uppercase text-slate-400 mb-4">{ant.vendor}</p><div className="flex justify-between pt-4 border-t text-[10px] font-black uppercase text-slate-500"><span>{ant.gainDbi}dBi</span><span>{ant.ports} Ports</span></div></div>))}</div>}
                {activeTab === 'ai' && <div className="max-w-3xl mx-auto h-[70vh] flex flex-col"><div className="flex-grow bg-slate-50 rounded-3xl p-8 overflow-y-auto mb-6 border shadow-inner custom-scrollbar">{chatHistory.map((m, i) => (<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}><div className={`p-5 rounded-2xl max-w-[85%] text-sm ${m.role === 'user' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-800 shadow-sm'}`}>{m.text}</div></div>))}</div><div className="flex gap-3 p-3 bg-white rounded-2xl border shadow-xl items-center"><input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} className="flex-grow px-4 py-3 outline-none font-bold text-slate-700" placeholder="Ask advisor..." /><button onClick={sendChatMessage} className="bg-blue-600 p-3 rounded-xl text-white hover:bg-blue-700 shadow-lg"><Send size={20} /></button></div></div>}
              </div>
            </div>
          )}
        </div>
      </main>

      <aside className={`fixed inset-y-0 right-0 bg-white text-slate-900 flex flex-col shadow-2xl z-[2000] transition-transform duration-500 ${selectedSiteId ? 'translate-x-0' : 'translate-x-full'} w-full md:w-[420px]`}>
        <div className="flex justify-between items-center p-6 border-b bg-slate-50/30"><h2 className="font-black uppercase tracking-widest text-[11px] text-slate-500">Node Configuration</h2><button onClick={() => setSelectedSiteId(null)} className="p-2 bg-white border rounded-xl text-slate-400 hover:text-slate-800 transition-all"><X size={18} /></button></div>
        <div className="p-6 h-full overflow-y-auto custom-scrollbar">{selectedSite && <SiteDetails site={selectedSite} allSites={sites} onUpdate={u => setSites(prev => prev.map(s => s.id === u.id ? u : s))} onDelete={() => { setSites(prev => prev.filter(s => s.id !== selectedSite.id)); setSelectedSiteId(null); }} />}</div>
        <div className="p-6 border-t bg-slate-50/50 flex gap-3"><button onClick={() => setSelectedSiteId(null)} className="flex-grow py-3 bg-white border rounded-xl text-[10px] font-black uppercase text-slate-400">Discard</button><button onClick={() => { startSimulation(); setSelectedSiteId(null); }} className="flex-grow py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Apply</button></div>
      </aside>
    </div>
  );
};

export default App;
