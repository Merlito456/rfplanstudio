
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
  Sparkles
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

  // Persistence Logic
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

  // Map Initialization
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

  // Base Layer Toggle Fix
  useEffect(() => {
    if (!mapInstance) return;

    if (baseLayerRef.current) {
      mapInstance.removeLayer(baseLayerRef.current);
    }

    const topoUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
    const satUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    
    const url = mapType === 'satellite' ? satUrl : topoUrl;
    const attribution = mapType === 'satellite' ? 'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics' : 'Esri, HERE, Garmin, OpenStreetMap contributors';

    baseLayerRef.current = L.tileLayer(url, {
      maxZoom: 19,
      attribution,
      crossOrigin: true
    }).addTo(mapInstance);

    // Ensure it's always at the bottom
    baseLayerRef.current.bringToBack();
  }, [mapType, mapInstance]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstance) return;
    setIsSearching(true);

    const q = searchQuery.trim();
    // Regex for GPS coordinates: "lat, lng" or "lat lng"
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
      if (data && data.length > 0) {
        mapInstance.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 16);
      } else {
        alert("Location not found. Try a specific place name or GPS (lat, lng).");
      }
    } catch (err) { 
      console.error("Search error", err); 
    } finally { 
      setIsSearching(false); 
    }
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
    const newComment: ProjectComment = {
      id: crypto.randomUUID(),
      lat, lng,
      text,
      author: 'Collaborator',
      timestamp: Date.now(),
      category: 'general'
    };
    setComments(prev => [...prev, newComment]);
    setInteractionMode('none');
  };

  const deleteComment = (id: string) => setComments(prev => prev.filter(c => c.id !== id));

  useEffect(() => {
    if (!probeLocation) return;
    const profile = getPhoneSignalProfile(sites, probeLocation.lat, probeLocation.lng, enableTerrain);
    setPhoneState(prev => ({ ...prev, ...profile, lat: probeLocation.lat, lng: probeLocation.lng } as PhoneDeviceState));
  }, [probeLocation, sites, enableTerrain]);

  const handleAISuggestSite = async () => {
    if (sites.length === 0) {
      alert("Deploy at least one site first to help the AI understand your area of interest.");
      return;
    }
    setIsSuggesting(true);
    const result = await suggestNextSite(sites);
    if (result && result.suggestions) {
      setSuggestedSites(prev => [...prev, ...result.suggestions]);
      if (mapInstance && result.suggestions.length > 0) {
        mapInstance.flyTo([result.suggestions[0].lat, result.suggestions[0].lng], 15);
      }
    }
    setIsSuggesting(false);
  };

  const deploySuggestedSite = (suggestionIndex: number) => {
    const suggestion = suggestedSites[suggestionIndex];
    if (!suggestion) return;
    const { lat, lng, ...config } = suggestion;
    deploySite(lat, lng, config);
    setSuggestedSites(prev => prev.filter((_, i) => i !== suggestionIndex));
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
    const currentInput = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', text: currentInput }]);
    setChatInput('');
    setIsAILoading(true);
    const response = await getRFAdvice(sites, currentInput);
    setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    setIsAILoading(false);
  };

  const selectedSite = useMemo(() => sites.find(s => s.id === selectedSiteId), [sites, selectedSiteId]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <nav className="w-16 flex flex-col items-center py-6 bg-white border-r border-slate-200 space-y-8 z-[1002] shadow-xl">
        <div className="text-blue-600 font-black text-2xl tracking-tighter">RF</div>
        <button onClick={() => setActiveTab('map')} className={`p-3 rounded-xl transition-all ${activeTab === 'map' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400 hover:text-blue-600'}`}><MapIcon size={24} /></button>
        <button onClick={() => setActiveTab('library')} className={`p-3 rounded-xl transition-all ${activeTab === 'library' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400 hover:text-blue-600'}`}><BookOpen size={24} /></button>
        <button onClick={() => setActiveTab('analytics')} className={`p-3 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400 hover:text-blue-600'}`}><BarChart2 size={24} /></button>
        <button onClick={() => setActiveTab('ai')} className={`p-3 rounded-xl transition-all ${activeTab === 'ai' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-400 hover:text-blue-600'}`}><Cpu size={24} /></button>
      </nav>

      <main className="flex-grow flex flex-col relative overflow-hidden">
        <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-slate-200 z-[1000] shadow-sm">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <input value={projectName} onChange={e => setProjectName(e.target.value)} className="text-lg font-extrabold tracking-tight text-slate-800 bg-transparent border-none outline-none focus:ring-0 w-48" />
              <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <History size={10} /> Saved {new Date(lastSaved).toLocaleTimeString()}
              </div>
            </div>
            <div className="h-10 w-[1px] bg-slate-200 mx-2" />
            <div className="flex items-center gap-4">
              <form onSubmit={handleSearch} className="relative w-80 group">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Place or GPS (lat, lng)..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" />
                <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600">
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </form>
              <div className="flex items-center gap-2">
                <button onClick={exportProject} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all" title="Export Project JSON"><Download size={18} /></button>
                <label className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all cursor-pointer" title="Import Project JSON">
                  <Upload size={18} />
                  <input type="file" className="hidden" accept=".json" onChange={importProject} />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button onClick={() => setMapType('map')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mapType === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Map</button>
              <button onClick={() => setMapType('satellite')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mapType === 'satellite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Sat</button>
            </div>
            <div className="h-8 w-[1px] bg-slate-200 mx-2" />
            
            <button onClick={() => setEnableTerrain(!enableTerrain)} className={`p-2.5 rounded-xl border transition-all ${enableTerrain ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-200 text-slate-400'}`} title="Enable Terrain Pathloss"><Landmark size={20} /></button>
            
            <button 
              onClick={handleAISuggestSite} 
              disabled={isSuggesting || sites.length === 0} 
              className={`p-2.5 rounded-xl border transition-all ${isSuggesting ? 'bg-amber-100 border-amber-500 text-amber-600' : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200'}`} 
              title="AI Site Suggestion"
            >
              {isSuggesting ? <Loader2 size={20} className="animate-spin" /> : <Target size={20} />}
            </button>

            <button onClick={() => setInteractionMode(interactionMode === 'comment' ? 'none' : 'comment')} className={`p-2.5 rounded-xl border transition-all ${interactionMode === 'comment' ? 'bg-blue-100 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`} title="Add Technical Comment"><MessageSquare size={20} /></button>
            <button onClick={() => setInteractionMode(interactionMode === 'probe' ? 'none' : 'probe')} className={`p-2.5 rounded-xl border transition-all ${interactionMode === 'probe' ? 'bg-blue-100 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`} title="Probe Point Signal"><Crosshair size={20} /></button>
            
            <button onClick={startSimulation} disabled={isSimulating || sites.length === 0} className="bg-blue-600 px-6 py-2.5 rounded-xl text-white text-sm font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {isSimulating ? <Loader2 className="animate-spin" size={18} /> : <Maximize2 size={18} />} Scan
            </button>
            <button onClick={() => setInteractionMode(interactionMode === 'placement' ? 'none' : 'placement')} className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${interactionMode === 'placement' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20'}`}>
              <PlusCircle size={18} /> {interactionMode === 'placement' ? 'Cancel' : 'Deploy'}
            </button>
          </div>
        </header>

        <div className="flex-grow relative bg-white overflow-hidden">
          <div className={`absolute inset-0 z-0 ${activeTab === 'map' ? 'visible' : 'invisible pointer-events-none'}`}>
            <div ref={mapContainerRef} className="w-full h-full cursor-crosshair" />
            <Heatmap points={coveragePoints} map={mapInstance} />
            {interactionMode === 'probe' && probeLocation && mapInstance && <PhoneSimulator state={phoneState} map={mapInstance} mapVersion={mapVersion} />}
            
            <div className="absolute inset-0 pointer-events-none z-[500]">
               {mapInstance && sites.map(site => {
                  const point = mapInstance.latLngToContainerPoint([site.lat, site.lng]);
                  const isSelected = selectedSiteId === site.id;
                  return (
                    <div key={site.id} onClick={(e) => { e.stopPropagation(); setSelectedSiteId(site.id); }} className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 active:scale-95 will-change-transform" style={{ left: point.x, top: point.y }}>
                       <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-white shadow-xl' : 'bg-white border-slate-200 shadow-md hover:border-blue-400'}`}>
                          <TowerIcon size={20} className={isSelected ? 'text-white' : 'text-slate-600'} />
                       </div>
                    </div>
                  );
               })}

               {mapInstance && suggestedSites.map((s, i) => {
                  const point = mapInstance.latLngToContainerPoint([s.lat, s.lng]);
                  return (
                    <div key={`suggest-${i}`} className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 group cursor-pointer" style={{ left: point.x, top: point.y }} onClick={(e) => { e.stopPropagation(); deploySuggestedSite(i); }}>
                       <div className="w-12 h-12 rounded-full bg-amber-500/10 border-2 border-dashed border-amber-500 flex items-center justify-center animate-pulse hover:bg-amber-500/30 transition-all hover:scale-125">
                          <Target size={24} className="text-amber-500" />
                       </div>
                       <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-amber-600/90 backdrop-blur-sm text-[8px] text-white px-2 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all shadow-xl pointer-events-none flex flex-col items-center gap-1">
                         <span className="font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10} /> Click to Deploy</span>
                         <span className="font-bold text-white/90">{s.name} ({s.towerType})</span>
                         <span className="opacity-70 italic font-medium">{s.reason}</span>
                       </div>
                    </div>
                  );
               })}

               {mapInstance && comments.map(comment => {
                  const point = mapInstance.latLngToContainerPoint([comment.lat, comment.lng]);
                  return (
                    <div key={comment.id} className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 group cursor-help" style={{ left: point.x, top: point.y }}>
                       <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-blue-500/20 hover:scale-125 transition-all">
                          <MessageSquare size={14} />
                       </div>
                       <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl min-w-[200px] opacity-0 group-hover:opacity-100 transition-all shadow-2xl pointer-events-none border border-white/10">
                          <div className="flex justify-between items-start mb-2">
                             <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Collab Note</span>
                             <span className="text-[8px] opacity-50 font-mono">{new Date(comment.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs font-bold leading-relaxed">{comment.text}</p>
                          <div className="mt-3 text-[9px] font-medium opacity-50 flex items-center gap-1"><CheckCircle2 size={10}/> Added by {comment.author}</div>
                       </div>
                    </div>
                  );
               })}
            </div>
            <Legend showSimulator={interactionMode === 'probe' && !!probeLocation} />
          </div>
          
          {activeTab === 'library' && (
            <div className="p-10 max-w-6xl mx-auto h-full overflow-y-auto relative z-10">
              <h2 className="text-4xl font-black text-slate-800 mb-10 tracking-tight">Antenna Library</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {ANTENNA_LIBRARY.map(ant => (
                  <div key={ant.id} className="bg-white border border-slate-200 rounded-3xl p-8 hover:border-blue-500 transition-all shadow-md group">
                    <div className="flex justify-between items-start mb-6">
                      <div><h3 className="text-2xl font-black text-slate-800 group-hover:text-blue-600 transition-colors">{ant.model}</h3><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{ant.vendor}</p></div>
                      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><Radio size={24} /></div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b text-[11px] font-bold uppercase tracking-tight text-slate-500"><span>Peak Gain</span><span className="text-emerald-600 font-black">{ant.gainDbi} dBi</span></div>
                      <div className="flex justify-between py-2 border-b text-[11px] font-bold uppercase tracking-tight text-slate-500"><span>Beamwidth</span><span className="text-slate-800 font-black">{ant.horizontalBeamwidth}° H / {ant.verticalBeamwidth}° V</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="h-full flex flex-col max-w-4xl mx-auto p-12 bg-white relative z-10 shadow-2xl border-x">
              <div className="flex items-center gap-5 mb-10">
                <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-500/20"><Database size={30} /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Engineering Core</h2>
                    <span className="bg-emerald-100 text-emerald-600 text-[10px] px-2 py-0.5 rounded font-black uppercase">Offline</span>
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Local Propagation Heuristics [WASM]</p>
                </div>
              </div>
              <div className="flex-grow bg-slate-50 rounded-[2.5rem] border border-slate-200 p-8 overflow-y-auto mb-10 flex flex-col gap-5">
                {chatHistory.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-5 rounded-3xl max-w-[80%] shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                      <div className="text-[9px] uppercase font-black opacity-40 mb-1">{m.role === 'user' ? 'Planner' : 'Core v4.2'}</div>
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                        {m.text.split('\n').map((line, li) => (<p key={li} className="m-0">{line}</p>))}
                      </div>
                    </div>
                  </div>
                ))}
                {isAILoading && <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 animate-pulse"><HardDrive size={12} className="animate-spin" /> Fetching Local Heuristics...</div>}
              </div>
              <div className="flex gap-4 p-2 bg-white rounded-[2rem] shadow-2xl border border-slate-200">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} className="flex-grow bg-transparent px-6 py-4 outline-none font-bold" placeholder="Query antenna specs, path loss, or site design..." />
                <button onClick={sendChatMessage} className="bg-blue-600 p-5 rounded-full text-white shadow-xl hover:bg-blue-700 active:scale-95"><Send size={24} /></button>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
             <div className="p-12 h-full overflow-y-auto max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                   <h2 className="text-4xl font-black text-slate-800 mb-10 tracking-tight">Project Status</h2>
                   <div className="grid grid-cols-2 gap-8">
                      <div className="bg-white p-10 rounded-[2rem] border border-slate-200 shadow-xl"><div className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-4">Site Count</div><div className="text-6xl font-black text-slate-800">{sites.length}</div></div>
                      <div className="bg-white p-10 rounded-[2rem] border border-slate-200 shadow-xl"><div className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-4">Total TRX</div><div className="text-6xl font-black text-blue-600">{sites.reduce((a, b) => a + b.sectors.length, 0)}</div></div>
                   </div>
                </div>
                <div className="flex flex-col">
                   <h2 className="text-4xl font-black text-slate-800 mb-10 tracking-tight flex items-center gap-4">Annotations <span className="text-blue-600 bg-blue-50 px-4 py-1 rounded-2xl text-xl">{comments.length}</span></h2>
                   <div className="flex-grow space-y-4">
                      {comments.map(c => (
                        <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md group relative hover:border-blue-300 transition-all">
                           <button onClick={() => deleteComment(c.id)} className="absolute top-6 right-6 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                           <div className="flex items-center gap-3 mb-3"><div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><MessageSquare size={16} /></div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{new Date(c.timestamp).toLocaleString()}</div></div>
                           <p className="text-slate-700 font-bold mb-4">{c.text}</p>
                           <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter"><span className="flex items-center gap-1"><MapIcon size={10} /> {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span><span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Collaborator Author</span></div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          )}
        </div>
      </main>

      <aside className={`w-[450px] bg-white text-slate-900 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.1)] z-[1002] transition-transform duration-500 ${selectedSiteId ? 'translate-x-0' : 'translate-x-full absolute right-0'}`}>
        <div className="p-10 h-full overflow-y-auto">
          {selectedSite ? <SiteDetails site={selectedSite} allSites={sites} onUpdate={u => setSites(prev => prev.map(s => s.id === u.id ? u : s))} onDelete={() => { setSites(prev => prev.filter(s => s.id !== selectedSite.id)); setSelectedSiteId(null); }} /> : null}
        </div>
        <div className="p-8 border-t bg-slate-50 flex gap-4">
           <button onClick={() => setSelectedSiteId(null)} className="flex-grow py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400 tracking-widest">Close</button>
           <button onClick={() => { startSimulation(); setSelectedSiteId(null); }} className="flex-grow py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95">Commit Site</button>
        </div>
      </aside>
    </div>
  );
};

export default App;
