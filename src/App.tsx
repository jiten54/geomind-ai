import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Cpu, 
  Layers, 
  MessageSquare, 
  Play, 
  Settings, 
  Zap,
  ChevronRight,
  Info,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MapView from './components/MapView';
import PredictionChart from './components/PredictionChart';
import AIAssistant from './components/AIAssistant';
import { cn } from './lib/utils';

export default function App() {
  const [infrastructure, setInfrastructure] = useState<any>(null);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showSky, setShowSky] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Fetch initial data
    fetch('/api/infrastructure')
      .then(res => res.json())
      .then(data => setInfrastructure(data));

    // Setup WebSocket
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('infrastructure-update', (data) => {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${data.type.toUpperCase()}: ${data.severity} severity event on ID ${data.targetId}`, ...prev].slice(0, 5));
      
      setInfrastructure(prev => {
        if (!prev) return prev;
        const newFeatures = prev.features.map((f: any) => {
          if (f.properties.id === data.targetId) {
            if (data.type === 'failure') {
              return {
                ...f,
                properties: { ...f.properties, status: 'critical', load: 100 }
              };
            } else if (data.type === 'spike') {
              const newLoad = Math.min(100, f.properties.load + 35);
              return {
                ...f,
                properties: { 
                  ...f.properties, 
                  load: newLoad, 
                  status: newLoad > 80 ? 'warning' : f.properties.status 
                }
              };
            }
          }
          return f;
        });
        return { ...prev, features: newFeatures };
      });
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleFeatureClick = async (feature: any) => {
    setSelectedFeature(feature);
    // Fetch predictions for this feature
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId: feature.id, timeframe: 'short' })
    });
    const data = await res.json();
    setPredictions(data.predictions);
  };

  const runSimulation = (type: 'failure' | 'spike') => {
    if (socket) {
      socket.emit('simulate-event', {
        type,
        targetId: Math.floor(Math.random() * 3) + 1,
        severity: Math.random() > 0.5 ? 'high' : 'medium'
      });
    }
  };

  return (
    <div className="relative w-screen h-screen bg-background flex overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-20 h-full border-r border-white/10 flex flex-col items-center py-8 gap-8 z-50 bg-background/80 backdrop-blur-md">
        <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,242,255,0.3)]">
          <Cpu className="text-black" size={24} />
        </div>
        <div className="flex-1 flex flex-col gap-6">
          <NavIcon icon={<Activity size={22} />} active />
          <NavIcon icon={<Layers size={22} />} />
          <NavIcon icon={<BarChart3 size={22} />} />
          <NavIcon icon={<Settings size={22} />} />
        </div>
        <button 
          onClick={() => setShowAI(!showAI)}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
            showAI ? "bg-accent text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"
          )}
        >
          <MessageSquare size={22} />
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {/* Map View */}
        <MapView 
          onFeatureClick={handleFeatureClick} 
          infrastructureData={infrastructure} 
          showBuildings={showBuildings}
          showSky={showSky}
        />

        {/* Top Header Panel */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
          <div className="glass-panel p-4 pointer-events-auto flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tighter flex items-center gap-2">
                GEOMIND <span className="text-accent font-light">AI</span>
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">Autonomous Intelligence Platform</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex gap-4">
              <StatMini label="Active Nodes" value="1,284" trend="+12" />
              <StatMini label="System Load" value="42%" trend="-5" />
              <StatMini label="Risk Index" value="0.04" trend="Stable" />
            </div>
          </div>

          <div className="glass-panel p-2 pointer-events-auto flex gap-2">
            <button 
              onClick={() => runSimulation('failure')}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors"
            >
              <AlertTriangle size={14} /> SIMULATE FAILURE
            </button>
            <button 
              onClick={() => runSimulation('spike')}
              className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold rounded-lg flex items-center gap-2 transition-colors"
            >
              <Zap size={14} /> DEMAND SPIKE
            </button>
          </div>
        </div>

        {/* Right Analytics Panel */}
        <AnimatePresence>
          {selectedFeature && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="absolute top-24 right-6 bottom-6 w-96 glass-panel p-6 pointer-events-auto overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedFeature.name}</h2>
                  <p className="text-sm text-gray-400">ID: {selectedFeature.id} • Sector 7G</p>
                </div>
                <button 
                  onClick={() => setSelectedFeature(null)}
                  className="p-1 hover:bg-white/10 rounded-lg text-gray-500"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Current Load</p>
                  <p className="text-2xl font-mono text-accent">{selectedFeature.load}%</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Status</p>
                  <p className={cn(
                    "text-lg font-bold uppercase",
                    selectedFeature.status === 'stable' ? 'text-green-400' : 'text-yellow-400'
                  )}>
                    {selectedFeature.status}
                  </p>
                </div>
              </div>

              <PredictionChart data={predictions} title="Predictive Demand Forecast" />

              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">AI Recommendations</h3>
                <RecommendationItem 
                  title="Load Balancing Required" 
                  desc="Suggesting redirection of 15% capacity to Grid Beta." 
                />
                <RecommendationItem 
                  title="Maintenance Window" 
                  desc="Optimal window detected: 02:00 - 04:00 AM." 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Log Panel */}
        <div className="absolute bottom-6 left-6 flex gap-4 pointer-events-none">
          <div className="glass-panel p-4 w-80 pointer-events-auto">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Play size={10} className="text-accent" /> Live System Logs
            </h3>
            <div className="space-y-2">
              {logs.length > 0 ? logs.map((log, i) => (
                <div key={i} className="text-[11px] font-mono text-gray-400 border-l-2 border-accent/30 pl-2 py-1">
                  {log}
                </div>
              )) : (
                <div className="text-[11px] font-mono text-gray-600 italic">Waiting for system events...</div>
              )}
            </div>
          </div>

          <div className="glass-panel p-4 pointer-events-auto flex flex-col gap-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Layers size={10} className="text-accent" /> Map Layers
            </h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => setShowBuildings(!showBuildings)}
                  className={cn(
                    "w-8 h-4 rounded-full relative transition-colors",
                    showBuildings ? "bg-accent" : "bg-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    showBuildings ? "left-4.5" : "left-0.5"
                  )} />
                </div>
                <span className="text-[11px] font-medium text-gray-400 group-hover:text-white transition-colors">3D Buildings</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => setShowSky(!showSky)}
                  className={cn(
                    "w-8 h-4 rounded-full relative transition-colors",
                    showSky ? "bg-accent" : "bg-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    showSky ? "left-4.5" : "left-0.5"
                  )} />
                </div>
                <span className="text-[11px] font-medium text-gray-400 group-hover:text-white transition-colors">Atmospheric Sky</span>
              </label>
            </div>
          </div>
        </div>
      </main>

      {/* AI Assistant Drawer */}
      <AnimatePresence>
        {showAI && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 h-full w-[450px] bg-background border-l border-white/10 z-[60] shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between p-6 border-bottom border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Bot className="text-accent" size={20} />
                </div>
                <div>
                  <h2 className="font-bold">GeoMind Intelligence</h2>
                  <p className="text-[10px] text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Neural Link Active
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAI(false)}
                className="p-2 hover:bg-white/5 rounded-full text-gray-500"
              >
                <ChevronRight size={24} />
              </button>
            </div>
            <div className="flex-1 h-[calc(100%-100px)]">
              <AIAssistant />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavIcon({ icon, active = false }: { icon: React.ReactNode; active?: boolean }) {
  return (
    <button className={cn(
      "p-3 rounded-xl transition-all",
      active ? "bg-accent/10 text-accent" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
    )}>
      {icon}
    </button>
  );
}

function StatMini({ label, value, trend }: { label: string; value: string; trend: string }) {
  const isPositive = trend.startsWith('+');
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-gray-500 uppercase font-bold">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-mono font-bold">{value}</span>
        <span className={cn(
          "text-[9px] font-bold",
          isPositive ? "text-green-400" : trend === 'Stable' ? "text-accent" : "text-red-400"
        )}>{trend}</span>
      </div>
    </div>
  );
}

function RecommendationItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex gap-3 items-start">
      <div className="mt-1 p-1.5 bg-accent/10 rounded-lg">
        <Info size={14} className="text-accent" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-white">{title}</h4>
        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
