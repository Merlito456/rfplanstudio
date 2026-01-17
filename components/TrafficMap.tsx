
import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { getSyntheticHumanTraffic } from '../services/rfEngine';

interface Props {
  map: L.Map | null;
}

const TrafficMap: React.FC<Props> = ({ map }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!map || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const render = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bounds = map.getBounds();
      const zoom = map.getZoom();
      
      // Dynamic grid based on zoom
      const step = zoom > 14 ? 0.001 : 0.003;
      
      for (let lat = bounds.getSouth(); lat <= bounds.getNorth(); lat += step) {
        for (let lng = bounds.getWest(); lng <= bounds.getEast(); lng += step) {
          const traffic = getSyntheticHumanTraffic(lat, lng);
          if (traffic < 15) continue;

          const point = map.latLngToContainerPoint([lat, lng]);
          const radius = zoom * 1.5;

          const opacity = (traffic / 100) * 0.4;
          // Traffic is Rose/Red for high density
          const r = traffic > 70 ? 244 : 59;
          const g = traffic > 70 ? 63 : 130;
          const b = traffic > 70 ? 94 : 246;

          const grad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    render();
    map.on('moveend zoomend', render);
    return () => { map.off('moveend zoomend', render); };
  }, [map]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-[350]"
      style={{ 
        filter: 'blur(15px) saturate(2)',
        opacity: 0.6,
        mixBlendMode: 'screen'
      }}
    />
  );
};

export default TrafficMap;
