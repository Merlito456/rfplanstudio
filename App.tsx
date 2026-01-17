
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Site, CoveragePoint, ChatMessage, TowerType, PhoneDeviceState, Sector, ProjectComment, RFProject } from './types';
import { ANTENNA_LIBRARY, DEFAULT_SITE } from './constants';
import { runSimulation, getBestRSRPAtPoint, getPhoneSignalProfile } from './services/rfEngine';
import { getRFAdvice, suggestNextSite } from './services/geminiService';
import SiteDetails from './components/SiteDetails';
import Heatmap from './components/Heatmap';
import PhoneSimulator from './components/PhoneSimulator';
import Legend from './components/Legend';
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
  CheckCircle2,
  Crosshair,
  Database,
  HardDrive,
  MessageSquare,
  Save,
  Download,
  Upload,
  History,
  Trash2,
  AlertCircle,
  MapPin,
  Menu,
  X
} from 'lucide-react';

interface Suggestion extends Partial<Site> {
  lat: number;
  lng: number;
  reason: string;
}

const STORAGE_KEY = 'rf_plan_studio_current_project';

const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [projectName, setProjectName] = useState('New RF Project');
  const [lastSaved, setLastSaved] = useState<number>(Date.now());

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'library' | 'ai' | 'analytics'>('map');
  const [isSimulating, setIsSimulating] = useState(false);
  const [coveragePoints, setCoveragePoints] = useState<CoveragePoint[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'model', text: "Local Engineering Core v4.2 initialized. All propagation logic loaded to memory. How can I assist with your RF design today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [mapType, setMapType] = useState<'map' | 'satellite'>('map');
  const [interactionMode, setInteractionMode] = useState<'none' | 'placement' | 'probe' | 'comment'>('none');
  const [probeLocation, setProbeLocation] = useState<{lat: number, lng: number} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [enableTerrain, setEnableTerrain] = useState(true);
  const [suggestedSites, setSuggestedSites] = useState<Suggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);

  const [phoneState, setPhoneState] = useState<PhoneDeviceState>({
    lat: 40.7128, lng: -74.006, rsrp: -140, sinr: -20, servingCellId: null, servingSiteName: null, neighbors: [], handoverCount: 0, lastHandoverTime: null
  });

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);

  const saveProject = () => {
    const project: RFProject = { name: projectName, sites, comments, lastSaved: Date.now(), version: '1.0' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    setLastSaved(project.lastSaved);
  };

  const loadProject = (projectData?: string) => {
    try {
      const raw = projectData || localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const project: RFProject = JSON.parse(raw);
        setSites(project.sites || []);
        setComments(project.comments || []);
        setProjectName(project.name || 'Imported Project');
        setLastSaved(project.lastSaved || Date.now());
      }
    } catch (e) {
      console.error("Failed to load project", e);
    }
  };

  const exportProject = () => {
    const project: RFProject = { name: projectName, sites, comments, lastSaved: Date.now(), version: '1.0' };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, '_')}_RFPlan.json`;
    link.click();
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      loadProject(content);
    };
    reader.readAsText(file);
  };

  useEffect(() => { loadProject(); }, []);
  useEffect(() => { if (sites.length > 0 || comments.length > 0) saveProject(); }, [sites, comments, projectName]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false, maxZoom: 19 }).setView([40.7128, -74.006], 15);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    setMapInstance(map);

    const onMove = () => setMapVersion(v => v + 1);
    map.on('move zoom', onMove);

    return () => { 
      map.off('move zoom', onMove);
      map.remove(); 
    };
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    if (baseLayerRef.current) mapInstance.removeLayer(baseLayerRef.current);
    const topoUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
    const satUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const url = mapType === 'satellite' ? satUrl : topoUrl;
    baseLayerRef.current = L.tileLayer(url, { maxZoom: 19, crossOrigin: true }).addTo(mapInstance);
    baseLayerRef.current.bringToBack();
  }, [mapType, mapInstance]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstance) return;
    setIsSearching(true);
    const q = searchQuery.trim();
    const gpsRegex = /^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/;
    const spaceGpsRegex = /^(-?\d+(\.\d+)?)\s+(-?\d+(\.\d+)?)$/;
    const match = q.match(gpsRegex) || q.match(spaceGpsRegex);

    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[3]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        mapInstance.flyTo([lat, lng], 16);
        setIsSearching(false);
        return;
      }
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) mapInstance.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 16);
      else alert("Location not found.");
    } catch (err) { console.error(err); } finally { setIsSearching(false); }
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
      name: config?.name || `Hub ${sites.length + 1}`, 
      lat, lng, 
      towerHeightM: config?.towerHeightM || DEFAULT_SITE.towerHeightM,
      towerType: config?.towerType as TowerType || DEFAULT_SITE.towerType,
      sectors: config?.sectors?.map(s => ({ ...s, id: crypto.randomUUID() })) || []
    };
    setSites(prev => [...prev, newSite]);
    setSelectedSiteId(newSite.id);
    setInteractionMode('none');
  };

  const addComment = (lat: number, lng: number) => {
    const text = prompt("Enter Technical Note / Comment:");
    if (!text) { setInteractionMode('none'); return; }
    setComments(prev => [...prev, { id: crypto.randomUUID(), lat, lng, text, author: 'Planner', timestamp: Date.now(), category: 'general' }]);
    setInteractionMode('none');
  };

  const handleAISuggestSite = async () => {
    if (sites.length === 0) return alert("Deploy a site first.");
    setIsSuggesting(true);
    const result = await suggestNextSite(sites);
    if (result?.suggestions) {
      setSuggestedSites(prev => [...prev, ...result.suggestions]);
      if (mapInstance && result.suggestions.length > 0) mapInstance.flyTo([result.suggestions[0].lat, result.suggestions[0].lng], 15);
    }
    setIsSuggesting(false);
  };

  const startSimulation = () => {
    if (sites.length === 0) return;
    setIsSimulating(true);
    setTimeout(() => {
      setCoveragePoints(runSimulation(sites, 6, 0.00028, enableTerrain));
      setIsSimulating(false);
    }, 800);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const input = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', text: input }]);
    setChatInput('');
    setIsAILoading(true);
    const response = await getRFAdvice(sites, input);
    setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    setIsAILoading(false);
  };

  const selectedSite = useMemo(() => sites.find(s => s.id === selectedSiteId), [sites, selectedSiteId]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Navigation: Sidebar on Desktop, Bottom Bar on Mobile */}
      <nav className="fixed bottom-0 left-0 w-full h-16 bg-white border-t border-slate-200 flex md:flex-col md:relative md:w-16 md:h-full md:border-r md:border-t-0 md:justify-start items-center justify-around py-0 md:py-6 z-[1002] shadow-xl md:space-y-8">
        <div className="hidden md:block text-blue-600 font-black text-2xl tracking-tighter">RF</div>
        {[
          { id: 'map', icon: MapIcon },
          { id: 'library', icon: BookOpen },
          { id: 'analytics', icon: BarChart2 },
          { id: 'ai', icon: Cpu }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`p-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400 hover:text-blue-600'}`}
          >
            <tab.icon size={24} />
          </button>
        ))}
      </nav>

      <main className="flex-grow flex flex-col relative overflow-hidden pb-16 md:pb-0">
        {/* Header: Responsive Layout */}
        <header className="flex flex-col md:flex-row md:h-20 items-start md:items-center justify-between px-4 md:px-8 bg-white border-b border-slate-200 z-[1000] shadow-sm py-3 md:py-0 gap-3 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-6">
            <div className="flex flex-col max-w-[120px] md:max-w-none">
              <input value={projectName} onChange={e => setProjectName(e.target.value)} className="text-sm md:text-lg font-extrabold tracking-tight text-slate-800 bg-transparent border-none outline-none focus:ring-0" />
              <div className="hidden md:flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <History size={10} /> Saved {new Date(lastSaved).toLocaleTimeString()}
              </div>
            </div>
            <div className="hidden md:block h-10 w-[1px] bg-slate-200 mx-2" />
            <form onSubmit={handleSearch} className="relative flex-grow md:w-80 group">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 md:pl-10 pr-4 py-2 text-[10px] md:text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500" />
              <button type="submit" className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </form>
          </div>

          {/* Action Toolbar: Scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar pb-1 md:pb-0">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button onClick={() => setMapType('map')} className={`px-3 md:px-4 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase ${mapType === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Map</button>
              <button onClick={() => setMapType('satellite')} className={`px-3 md:px-4 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase ${mapType === 'satellite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Sat</button>
            </div>
            <button onClick={() => setEnableTerrain(!enableTerrain)} className={`p-2 rounded-xl border shrink-0 ${enableTerrain ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-200 text-slate-400'}`}><Landmark size={18} /></button>
            <button onClick={handleAISuggestSite} disabled={isSuggesting || sites.length === 0} className={`p-2 rounded-xl border shrink-0 ${isSuggesting ? 'bg-amber-100 border-amber-500 text-amber-600' : 'bg-white border-slate-200 text-slate-400'}`}><Target size={18} /></button>
            <button onClick={() => setInteractionMode(interactionMode === 'comment' ? 'none' : 'comment')} className={`p-2 rounded-xl border shrink-0 ${interactionMode === 'comment' ? 'bg-blue-100 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}><MessageSquare size={18} /></button>
            <button onClick={() => setInteractionMode(interactionMode === 'probe' ? 'none' : 'probe')} className={`p-2 rounded-xl border shrink-0 ${interactionMode === 'probe' ? 'bg-blue-100 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}><Crosshair size={18} /></button>
            <button onClick={startSimulation} disabled={isSimulating || sites.length === 0} className="bg-blue-600 px-4 md:px-6 py-2 rounded-xl text-white text-[10px] md:text-sm font-black uppercase tracking-wider shrink-0 shadow-lg">
              {isSimulating ? <Loader2 className="animate-spin" size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={() => setInteractionMode(interactionMode === 'placement' ? 'none' : 'placement')} className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-sm font-black uppercase tracking-wider shrink-0 transition-all shadow-lg flex items-center gap-2 ${interactionMode === 'placement' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
              <PlusCircle size={16} /> {interactionMode === 'placement' ? 'Cancel' : 'Deploy'}
            </button>
          </div>
        </header>

        {/* Workspace Container */}
        <div className="flex-grow relative bg-white overflow-hidden">
          <div className={`absolute inset-0 z-0 ${activeTab === 'map' ? 'visible' : 'invisible pointer-events-none'}`}>
            <div ref={mapContainerRef} className="w-full h-full" />
            <Heatmap points={coveragePoints} map={mapInstance} />
            {interactionMode === 'probe' && probeLocation && mapInstance && <PhoneSimulator state={phoneState} map={mapInstance} mapVersion={mapVersion} />}
            
            {/* Markers */}
            <div className="absolute inset-0 pointer-events-none z-[500]">
               {mapInstance && sites.map(site => {
                  const point = mapInstance.latLngToContainerPoint([site.lat, site.lng]);
                  const isSelected = selectedSiteId === site.id;
                  return (
                    <div key={site.id} onClick={(e) => { e.stopPropagation(); setSelectedSiteId(site.id); }} className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 active:scale-95" style={{ left: point.x, top: point.y }}>
                       <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-white shadow-xl' : 'bg-white border-slate-200 shadow-md'}`}>
                          <TowerIcon size={isSelected ? 20 : 16} className={isSelected ? 'text-white' : 'text-slate-600'} />
                       </div>
                    </div>
                  );
               })}
            </div>
            <Legend showSimulator={interactionMode === 'probe' && !!probeLocation} />
          </div>

          {/* Tab Contents: Padded for Mobile */}
          {activeTab !== 'map' && (
            <div className="absolute inset-0 bg-white z-10 overflow-y-auto p-4 md:p-10">
              <div className="max-w-6xl mx-auto">
                {activeTab === 'library' && (
                  <div className="space-y-6">
                    <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">Antenna Library</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                      {ANTENNA_LIBRARY.map(ant => (
                        <div key={ant.id} className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-6 md:p-8 hover:border-blue-500 shadow-sm">
                          <h3 className="text-xl font-black text-slate-800">{ant.model}</h3>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">{ant.vendor}</p>
                          <div className="text-[11px] font-bold text-slate-500 uppercase border-t pt-4 flex justify-between">
                            <span>Gain: {ant.gainDbi}dBi</span>
                            <span>BW: {ant.horizontalBeamwidth}°</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {activeTab === 'ai' && (
                  <div className="max-w-2xl mx-auto h-[calc(100vh-250px)] flex flex-col">
                    <div className="flex-grow bg-slate-50 rounded-3xl border p-4 md:p-8 overflow-y-auto mb-4 flex flex-col gap-4">
                      {chatHistory.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-4 rounded-2xl max-w-[90%] text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                      {isAILoading && <Loader2 className="animate-spin text-blue-600 mx-auto" />}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} className="flex-grow bg-white border rounded-2xl px-4 py-3 outline-none" placeholder="Ask AI advisor..." />
                      <button onClick={sendChatMessage} className="bg-blue-600 p-3 rounded-2xl text-white"><Send size={20} /></button>
                    </div>
                  </div>
                )}

                {activeTab === 'analytics' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-3xl border shadow-sm">
                      <p className="text-slate-400 text-[10px] uppercase font-black mb-2">Total Sites</p>
                      <p className="text-5xl font-black">{sites.length}</p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border shadow-sm">
                      <p className="text-slate-400 text-[10px] uppercase font-black mb-2">Sectors</p>
                      <p className="text-5xl font-black text-blue-600">{sites.reduce((a, b) => a + b.sectors.length, 0)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Site Sidebar: Responsive Bottom Sheet / Side Panel */}
      <aside className={`fixed inset-y-0 right-0 md:relative md:inset-auto md:w-[450px] bg-white text-slate-900 flex flex-col shadow-2xl md:shadow-[0_0_50px_rgba(0,0,0,0.1)] z-[2000] md:z-[1002] transition-transform duration-500 ${selectedSiteId ? 'translate-x-0' : 'translate-x-full md:absolute md:right-0'} w-full md:w-[450px]`}>
        <div className="flex justify-between items-center p-6 border-b md:hidden">
          <h2 className="font-black uppercase tracking-widest text-sm">Site Configuration</h2>
          <button onClick={() => setSelectedSiteId(null)} className="p-2 bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-4 md:p-10 h-full overflow-y-auto">
          {selectedSite && <SiteDetails site={selectedSite} allSites={sites} onUpdate={u => setSites(prev => prev.map(s => s.id === u.id ? u : s))} onDelete={() => { setSites(prev => prev.filter(s => s.id !== selectedSite.id)); setSelectedSiteId(null); }} />}
        </div>
        <div className="p-4 md:p-8 border-t bg-slate-50 flex gap-3">
           <button onClick={() => setSelectedSiteId(null)} className="flex-grow py-3 md:py-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-400 tracking-widest">Cancel</button>
           <button onClick={() => { startSimulation(); setSelectedSiteId(null); }} className="flex-grow py-3 md:py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20">Commit</button>
        </div>
      </aside>
    </div>
  );
};

export default App;
