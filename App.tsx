
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Site, CoveragePoint, ChatMessage, TowerType, PhoneDeviceState, Sector, ProjectComment, RFProject } from './types';
import { ANTENNA_LIBRARY, DEFAULT_SITE } from './constants';
import { runSimulation, getBestRSRPAtPoint, getPhoneSignalProfile, findOptimalNextSites } from './services/rfEngine';
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

interface AISuggestion extends Partial<Site> {
  lat: number;
  lng: number;
  reason: string;
}

const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [projectName, setProjectName] = useState('New RF Project');
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'library' | 'ai' | 'analytics'>('map');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedSites, setSuggestedSites] = useState<AISuggestion[]>([]);
  const [coveragePoints, setCoveragePoints] = useState<CoveragePoint[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'model', text: "Local Engineering Core v4.2 initialized. How can I assist with your RF design?" }
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
  const mapInitLock = useRef(false);

  // Persistence
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const project: RFProject = JSON.parse(raw);
        setSites(project.sites || []);
        setComments(project.comments || []);
        setProjectName(project.name || 'New RF Project');
        setLastSaved(project.lastSaved || Date.now());
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

  // STABLE MAP INITIALIZATION
  useEffect(() => {
    if (!mapContainerRef.current || mapInitLock.current) return;
    
    mapInitLock.current = true;
    const map = L.map(mapContainerRef.current, { 
      zoomControl: false, 
      maxZoom: 19,
      trackResize: true
    }).setView([40.7128, -74.006], 14);
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    setMapInstance(map);

    const onMove = () => setMapVersion(v => v + 1);
    map.on('move zoom resize', onMove);

    return () => {
      map.off('move zoom resize', onMove);
      map.remove();
      mapInitLock.current = false;
      setMapInstance(null);
    };
  }, []);

  // Sync Phone Probe
  useEffect(() => {
    if (interactionMode === 'probe' && probeLocation) {
      const profile = getPhoneSignalProfile(sites, probeLocation.lat, probeLocation.lng, enableTerrain);
      setPhoneState(prev => ({ ...prev, ...profile }));
    }
  }, [sites, enableTerrain, interactionMode, probeLocation, mapVersion]);

  // Tile Layer
  useEffect(() => {
    if (!mapInstance) return;
    if (baseLayerRef.current) mapInstance.removeLayer(baseLayerRef.current);
    const topoUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
    const satUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const url = mapType === 'satellite' ? satUrl : topoUrl;
    baseLayerRef.current = L.tileLayer(url, { maxZoom: 19 }).addTo(mapInstance);
    baseLayerRef.current.bringToBack();
  }, [mapType, mapInstance]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstance) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data?.[0]) mapInstance.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 16);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!mapInstance) return;
    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (interactionMode === 'placement') deploySite(e.latlng.lat, e.latlng.lng);
      if (interactionMode === 'probe') setProbeLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      if (interactionMode === 'comment') addComment(e.latlng.lat, e.latlng.lng);
    };
    mapInstance.on('click', onMapClick);
    return () => { mapInstance.off('click', onMapClick); };
  }, [interactionMode, mapInstance]);

  const deploySite = (lat: number, lng: number, config?: Partial<Site>) => {
    const newSite: Site = { 
      ...DEFAULT_SITE, 
      id: crypto.randomUUID(), 
      name: config?.name || `Site ${sites.length + 1}`, 
      lat, lng, 
      towerHeightM: config?.towerHeightM || DEFAULT_SITE.towerHeightM,
      towerType: config?.towerType as TowerType || DEFAULT_SITE.towerType,
      sectors: config?.sectors?.map(s => ({...s, id: crypto.randomUUID()})) || [] 
    };
    setSites(prev => [...prev, newSite]);
    setSelectedSiteId(newSite.id);
    setInteractionMode('none');
    // If this was a suggestion, clear it
    setSuggestedSites(prev => prev.filter(s => Math.abs(s.lat - lat) > 0.0001));
  };

  const handleAISuggestSite = async () => {
    if (sites.length === 0) {
      alert("Deploy at least one initial site before requesting expansion logic.");
      return;
    }
    // Toggle suggestions visibility if already calculated
    if (suggestedSites.length > 0) {
      setSuggestedSites([]);
      return;
    }

    setIsSuggesting(true);
    // 100% Local Smart Engine Logic
    setTimeout(() => {
      const holes = findOptimalNextSites(sites);
      setSuggestedSites(holes.map((h, i) => ({ 
        lat: h.lat, 
        lng: h.lng, 
        reason: h.reason,
        name: `Proposed Node ${i + 1}`,
        towerHeightM: 35,
        towerType: TowerType.LATTICE,
        sectors: [] 
      })));
      setIsSuggesting(false);
      if (holes.length > 0 && mapInstance) {
        mapInstance.flyTo([holes[0].lat, holes[0].lng], mapInstance.getZoom());
      }
    }, 600);
  };

  const addComment = (lat: number, lng: number) => {
    const text = prompt("Note:");
    if (text) setComments(prev => [...prev, { id: crypto.randomUUID(), lat, lng, text, author: 'Planner', timestamp: Date.now(), category: 'general' }]);
    setInteractionMode('none');
  };

  const deleteComment = (id: string) => {
    if (window.confirm("Delete this technical note?")) {
      setComments(prev => prev.filter(c => c.id !== id));
    }
  };

  const clearAll = () => {
    if (window.confirm("Clear all sites and comments from this project?")) {
      setSites([]);
      setComments([]);
      setCoveragePoints([]);
      setSuggestedSites([]);
      setSelectedSiteId(null);
      setProbeLocation(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const startSimulation = () => {
    if (sites.length === 0) return;
    setIsSimulating(true);
    setTimeout(() => {
      setCoveragePoints(runSimulation(sites, 8, 0.0003, enableTerrain));
      setIsSimulating(false);
    }, 800);
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
      {/* Sidebar Navigation */}
      <nav className="flex flex-col w-16 h-full bg-white border-r border-slate-100 items-center py-6 z-[1002] space-y-4 shrink-0">
        <div className="text-blue-600 font-black text-xl mb-6 flex items-center justify-center w-full">RF</div>
        {[
          { id: 'map', icon: MapIcon },
          { id: 'library', icon: BookOpen },
          { id: 'analytics', icon: BarChart2 },
          { id: 'ai', icon: Cpu }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'}`}
          >
            <tab.icon size={20} />
          </button>
        ))}
        <div className="flex-grow" />
        <button 
          onClick={clearAll}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-all text-slate-400 hover:text-red-500 hover:bg-red-50"
          title="Clear Project"
        >
          <RefreshCcw size={20} />
        </button>
      </nav>

      <main className="flex-grow flex flex-col relative h-full overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between px-6 bg-white border-b border-slate-100 z-[1000] shrink-0">
          <div className="flex items-center gap-6 min-w-[200px]">
            <div className="flex flex-col">
              <input value={projectName} onChange={e => setProjectName(e.target.value)} className="text-sm font-extrabold text-slate-800 bg-transparent border-none outline-none focus:ring-0 p-0" />
              <div className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                <History size={10} /> SAVED {new Date(lastSaved).toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="flex-grow flex justify-center px-4 max-w-xl">
            <form onSubmit={handleSearch} className="relative w-full group">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search location..." className="w-full bg-slate-50 border-none rounded-full pl-10 pr-4 py-2 text-[11px] font-bold text-slate-600 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all outline-none" />
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" />
            </form>
          </div>

          <div className="flex items-center gap-4 min-w-[360px] justify-end">
            <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
              <button onClick={() => setMapType('map')} className={`px-4 py-1 rounded-full text-[9px] font-black uppercase transition-all ${mapType === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Map</button>
              <button onClick={() => setMapType('satellite')} className={`px-4 py-1 rounded-full text-[9px] font-black uppercase transition-all ${mapType === 'satellite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Sat</button>
            </div>
            
            <div className="flex items-center gap-1.5">
              {[
                { id: 'terrain', icon: Landmark, action: () => setEnableTerrain(!enableTerrain), active: enableTerrain, label: 'Terrain Propagation' },
                { id: 'suggest', icon: Target, action: handleAISuggestSite, active: isSuggesting || suggestedSites.length > 0, label: 'Smart Expansion Engine', loading: isSuggesting },
                { id: 'traffic', icon: Activity, action: () => setInteractionMode(interactionMode === 'traffic' ? 'none' : 'traffic'), active: interactionMode === 'traffic', label: 'Network Load Map' },
                { id: 'comment', icon: MessageSquare, action: () => setInteractionMode(interactionMode === 'comment' ? 'none' : 'comment'), active: interactionMode === 'comment', label: 'Field Note' },
                { id: 'probe', icon: Crosshair, action: () => setInteractionMode(interactionMode === 'probe' ? 'none' : 'probe'), active: interactionMode === 'probe', label: 'Signal Probe' }
              ].map(tool => (
                <button 
                  key={tool.id}
                  onClick={tool.action} 
                  title={tool.label}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all relative ${tool.active ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                >
                  {tool.loading ? <Loader2 size={16} className="animate-spin" /> : <tool.icon size={16} />}
                  {tool.id === 'suggest' && suggestedSites.length > 0 && !isSuggesting && <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white"></div>}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={startSimulation} disabled={isSimulating || sites.length === 0} className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50">
                {isSimulating ? <Loader2 size={14} className="animate-spin" /> : <Maximize2 size={14} />} 
                SCAN
              </button>
              <button 
                onClick={() => setInteractionMode(interactionMode === 'placement' ? 'none' : 'placement')} 
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 ${interactionMode === 'placement' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                <PlusCircle size={14} /> {interactionMode === 'placement' ? 'CANCEL' : 'DEPLOY'}
              </button>
            </div>
          </div>
        </header>

        {/* Full-Screen Workspace */}
        <div className="flex-grow relative w-full h-full bg-slate-50 overflow-hidden">
          <div className={`absolute inset-0 z-0 ${activeTab === 'map' ? 'visible' : 'invisible pointer-events-none'}`}>
            <div ref={mapContainerRef} className="w-full h-full" />
            
            {/* Layers */}
            <Heatmap points={coveragePoints} map={mapInstance} />
            {interactionMode === 'traffic' && <TrafficMap map={mapInstance} />}
            {interactionMode === 'probe' && probeLocation && mapInstance && <PhoneSimulator state={phoneState} map={mapInstance} mapVersion={mapVersion} />}
            
            {/* Sites, Comments & AI Suggestion Markers Overlay */}
            <div className="absolute inset-0 pointer-events-none z-[500]">
               {mapInstance && sites.map(site => {
                  const point = mapInstance.latLngToContainerPoint([site.lat, site.lng]);
                  const isSelected = selectedSiteId === site.id;
                  return (
                    <div key={site.id} onClick={(e) => { e.stopPropagation(); setSelectedSiteId(site.id); }} className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-110" style={{ left: point.x, top: point.y }}>
                       <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-white shadow-xl' : 'bg-white border-slate-300 shadow-sm'}`}>
                          <TowerIcon size={isSelected ? 16 : 14} className={isSelected ? 'text-white' : 'text-slate-500'} />
                       </div>
                    </div>
                  );
               })}

               {/* AI Suggested Sites */}
               {mapInstance && suggestedSites.map((s, idx) => {
                  const point = mapInstance.latLngToContainerPoint([s.lat, s.lng]);
                  return (
                    <div 
                      key={`suggest-${idx}`} 
                      onClick={(e) => { e.stopPropagation(); deploySite(s.lat, s.lng, s); }} 
                      className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 group cursor-pointer" 
                      style={{ left: point.x, top: point.y }}
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white animate-pulse">
                        <Sparkles size={14} />
                      </div>
                      {/* Reason Tooltip */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap z-[600] pointer-events-none shadow-xl border border-white/20">
                        {s.reason || "Optimal network expansion node."}
                      </div>
                      <button className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-white text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                        Deploy Suggestion
                      </button>
                    </div>
                  );
               })}
               
               {mapInstance && comments.map(comment => {
                  const point = mapInstance.latLngToContainerPoint([comment.lat, comment.lng]);
                  return (
                    <div key={comment.id} className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 group" style={{ left: point.x, top: point.y }}>
                       <div className="relative">
                          <div className="w-6 h-6 rounded-full bg-amber-500 border-2 border-white shadow-md flex items-center justify-center text-white">
                             <MessageSquare size={12} />
                          </div>
                          {/* Deletion Overlay on Click/Hover */}
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-100 rounded-lg shadow-xl px-3 py-1.5 flex items-center gap-2 whitespace-nowrap pointer-events-auto">
                             <span className="text-[10px] font-bold text-slate-700 max-w-[120px] truncate">{comment.text}</span>
                             <button onClick={() => deleteComment(comment.id)} className="text-red-500 hover:text-red-600 p-0.5 rounded">
                                <Trash2 size={12} />
                             </button>
                          </div>
                       </div>
                    </div>
                  );
               })}
            </div>
            <Legend showSimulator={interactionMode === 'probe' && !!probeLocation} />
          </div>

          {/* Overlays */}
          {activeTab !== 'map' && (
            <div className="absolute inset-0 bg-white z-[1001] overflow-y-auto p-12 animate-in fade-in duration-300">
              <div className="max-w-6xl mx-auto">
                {activeTab === 'library' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {ANTENNA_LIBRARY.map(ant => (
                      <div key={ant.id} className="p-6 border border-slate-100 rounded-3xl hover:border-blue-500 transition-all bg-white shadow-sm group">
                        <div className="flex justify-between items-start mb-4">
                          <div><h3 className="text-lg font-black text-slate-800 group-hover:text-blue-600">{ant.model}</h3><p className="text-[10px] font-bold uppercase text-slate-400">{ant.vendor}</p></div>
                          <Radio size={18} className="text-slate-200" />
                        </div>
                        <div className="flex justify-between pt-4 border-t border-slate-50 text-[10px] font-black uppercase text-slate-500">
                          <span>Gain: {ant.gainDbi}dBi</span><span>Ports: {ant.ports}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'ai' && (
                  <div className="max-w-3xl mx-auto h-[70vh] flex flex-col">
                    <div className="flex-grow bg-slate-50 rounded-3xl p-8 overflow-y-auto mb-6 border border-slate-100 shadow-inner custom-scrollbar">
                      {chatHistory.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                          <div className={`p-5 rounded-2xl max-w-[85%] text-sm ${m.role === 'user' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-slate-200 text-slate-800 shadow-sm'}`}>{m.text}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 p-3 bg-white rounded-2xl border shadow-xl items-center">
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} className="flex-grow px-4 py-3 outline-none font-bold text-slate-700" placeholder="Ask advisor..." />
                      <button onClick={sendChatMessage} className="bg-blue-600 p-3 rounded-xl text-white hover:bg-blue-700 shadow-lg"><Send size={20} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className={`fixed inset-y-0 right-0 bg-white text-slate-900 flex flex-col shadow-2xl z-[2000] transition-transform duration-500 ${selectedSiteId ? 'translate-x-0' : 'translate-x-full'} w-full md:w-[420px]`}>
        <div className="flex justify-between items-center p-6 border-b bg-slate-50/30">
          <h2 className="font-black uppercase tracking-widest text-[11px] text-slate-500">Node Configuration</h2>
          <button onClick={() => setSelectedSiteId(null)} className="p-2 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-slate-800 shadow-sm transition-all"><X size={18} /></button>
        </div>
        <div className="p-6 h-full overflow-y-auto custom-scrollbar">
          {selectedSite && <SiteDetails site={selectedSite} allSites={sites} onUpdate={u => setSites(prev => prev.map(s => s.id === u.id ? u : s))} onDelete={() => { setSites(prev => prev.filter(s => s.id !== selectedSite.id)); setSelectedSiteId(null); }} />}
        </div>
        <div className="p-6 border-t bg-slate-50/50 flex gap-3">
           <button onClick={() => setSelectedSiteId(null)} className="flex-grow py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100 transition-colors">Discard</button>
           <button onClick={() => { startSimulation(); setSelectedSiteId(null); }} className="flex-grow py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-blue-700 transition-all">Apply configuration</button>
        </div>
      </aside>
    </div>
  );
};

export default App;
