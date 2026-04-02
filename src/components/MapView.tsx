import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapViewProps {
  onFeatureClick: (feature: any) => void;
  infrastructureData: any;
  showBuildings: boolean;
  showSky: boolean;
}

const MapView: React.FC<MapViewProps> = ({ onFeatureClick, infrastructureData, showBuildings, showSky }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [lng] = useState(-74.006);
  const [lat] = useState(40.7128);
  const [zoom] = useState(14);

  const token = (import.meta as any).env.VITE_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    if (!token) {
      console.error("Mapbox token missing. Please add VITE_MAPBOX_ACCESS_TOKEN to .env");
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [lng, lat],
      zoom: 12,
      pitch: 75,
      bearing: -35,
      antialias: true
    });

      map.current.on('load', () => {
        if (!map.current) return;

        // Dynamic entry animation
        map.current.flyTo({
          center: [lng, lat],
          zoom: 15.5,
          pitch: 75,
          bearing: -35,
          duration: 4000,
          essential: true
        });

        // Subtle rotation animation
        let rotateDegree = -35;
        const rotateCamera = () => {
          if (!map.current) return;
          rotateDegree += 0.02;
          map.current.setBearing(rotateDegree % 360);
          animationFrameRef.current = requestAnimationFrame(rotateCamera);
        };
        setTimeout(rotateCamera, 4500);

        // Add 3D Terrain
      map.current.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
      });
      map.current.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });

      // Add Sky Layer for atmosphere
      map.current.addLayer({
        'id': 'sky',
        'type': 'sky',
        'paint': {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 15
        }
      });

      // Add 3D Buildings
      const layers = map.current.getStyle()?.layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
      )?.id;

      map.current.addLayer(
        {
          'id': 'add-3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#1a1a2e', // Tech-inspired dark blue
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.8
          }
        },
        labelLayerId
      );

      // Infrastructure Source with Clustering
      map.current.addSource('infrastructure', {
        type: 'geojson',
        data: infrastructureData || { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });

      // Heatmap Layer
      map.current.addLayer({
        id: 'infrastructure-heatmap',
        type: 'heatmap',
        source: 'infrastructure',
        maxzoom: 15,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'load'],
            0, 0,
            100, 1
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            15, 3
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 242, 255, 0)',
            0.2, 'rgba(0, 242, 255, 0.2)',
            0.4, 'rgba(0, 242, 255, 0.4)',
            0.6, 'rgba(255, 204, 0, 0.6)',
            0.8, 'rgba(255, 68, 68, 0.8)',
            1, 'rgba(255, 68, 68, 1)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 2,
            15, 20
          ],
          'heatmap-opacity': 0.6
        }
      }, 'add-3d-buildings');

      // Cluster Circles
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'infrastructure',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            'rgba(0, 242, 255, 0.2)',
            10, 'rgba(0, 242, 255, 0.4)',
            30, 'rgba(0, 242, 255, 0.6)'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            10, 30,
            30, 40
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#00f2ff',
          'circle-stroke-opacity': 0.5
        }
      });

      // Cluster Count Text
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'infrastructure',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Unclustered Points (Glowing Markers)
      map.current.addLayer({
        id: 'unclustered-point-glow',
        type: 'circle',
        source: 'infrastructure',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'status'],
            'stable', '#00f2ff',
            'warning', '#ffcc00',
            'critical', '#ff4444',
            '#ffffff'
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 6,
            15, 12
          ],
          'circle-blur': 1,
          'circle-opacity': 0.6
        }
      });

      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'infrastructure',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'status'],
            'stable', '#00f2ff',
            'warning', '#ffcc00',
            'critical', '#ff4444',
            '#ffffff'
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 3,
            15, 6
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.8
        }
      });

      // Interaction Handlers
      map.current.on('click', 'clusters', (e) => {
        const features = map.current?.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features?.[0].properties?.cluster_id;
        const source = map.current?.getSource('infrastructure') as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.current?.easeTo({
            center: (features?.[0].geometry as any).coordinates,
            zoom: zoom || 14
          });
        });
      });

      map.current.on('click', 'unclustered-point', (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        onFeatureClick(props);

        // Custom Popup
        new mapboxgl.Popup({
          closeButton: false,
          className: 'custom-mapbox-popup',
          maxWidth: '300px'
        })
          .setLngLat((e.features[0].geometry as any).coordinates)
          .setHTML(`
            <div class="glass-panel p-4 border-accent/20 min-w-[200px] backdrop-blur-md bg-black/60">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-sm font-bold text-white">${props.name}</h3>
                <span class="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 uppercase">${props.status}</span>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-[10px]">
                  <span class="text-gray-500 uppercase">Current Load</span>
                  <span class="text-white font-mono">${props.load}%</span>
                </div>
                <div class="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div class="bg-accent h-full" style="width: ${props.load}%"></div>
                </div>
                <div class="flex justify-between text-[10px] pt-1">
                  <span class="text-gray-500 uppercase">Risk Score</span>
                  <span class="text-red-400 font-mono">${(props.load * 0.01).toFixed(2)}</span>
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-white/5">
                <p class="text-[9px] text-accent italic">AI Prediction: Stable operations for next 6h</p>
              </div>
            </div>
          `)
          .addTo(map.current!);
      });

      map.current.on('mouseenter', 'unclustered-point', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'unclustered-point', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
      map.current.on('mouseenter', 'clusters', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'clusters', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
    });

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (map.current) map.current.remove();
    };
  }, [token, lng, lat, zoom]);

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      const source = map.current.getSource('infrastructure') as mapboxgl.GeoJSONSource;
      if (source) source.setData(infrastructureData);
    }
  }, [infrastructureData]);

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      if (map.current.getLayer('add-3d-buildings')) {
        map.current.setLayoutProperty(
          'add-3d-buildings',
          'visibility',
          showBuildings ? 'visible' : 'none'
        );
      }
      if (map.current.getLayer('sky')) {
        map.current.setLayoutProperty(
          'sky',
          'visibility',
          showSky ? 'visible' : 'none'
        );
      }
    }
  }, [showBuildings, showSky]);

  return (
    <div className="relative w-full h-full bg-[#050505]">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {!token && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-[100] text-center p-8 backdrop-blur-sm">
          <div className="max-w-md glass-panel p-8 border-accent/20">
            <h2 className="text-2xl font-bold text-accent mb-4 tracking-tighter">3D ENGINE OFFLINE</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              GeoMind AI requires a <span className="text-white font-bold">Mapbox Access Token</span> to initialize the 3D geospatial engine, terrain extrusion, and building models.
            </p>
            <div className="bg-white/5 p-4 rounded-xl mb-6 text-left border border-white/10">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Required Configuration</p>
              <code className="text-xs text-accent break-all">VITE_MAPBOX_ACCESS_TOKEN="your_token_here"</code>
            </div>
            <a 
              href="https://account.mapbox.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-3 bg-accent text-black font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all inline-block shadow-[0_0_20px_rgba(0,242,255,0.2)]"
            >
              GET ACCESS TOKEN
            </a>
          </div>
        </div>
      )}

      {/* 3D Legend */}
      <div className="absolute bottom-6 right-6 glass-panel p-4 z-50 pointer-events-none border-accent/10">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">3D Visualization Engine</h4>
        <div className="space-y-2">
          <LegendItem color="#00f2ff" label="Stable Node" />
          <LegendItem color="#ffcc00" label="Warning State" />
          <LegendItem color="#ff4444" label="Critical Risk" />
          <div className="pt-2 mt-2 border-t border-white/5">
            <p className="text-[8px] text-gray-600 uppercase mb-2">Risk Intensity (Heatmap)</p>
            <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-[#00f2ff]/20 via-[#ffcc00]/60 to-[#ff4444]" />
          </div>
        </div>
      </div>
    </div>
  );
};

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)]" style={{ backgroundColor: color }} />
      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{label}</span>
    </div>
  );
}

export default MapView;
