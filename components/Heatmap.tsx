
import React, { useEffect, useRef } from 'react';
import { CoveragePoint } from '../types';
import L from 'leaflet';

interface Props {
  points: CoveragePoint[];
  map: L.Map | null;
}

const Heatmap: React.FC<Props> = ({ points, map }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!map || !canvasRef.current || points.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const render = () => {
      const size = map.getSize();
      if (canvas.width !== size.x || canvas.height !== size.y) {
        canvas.width = size.x;
        canvas.height = size.y;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const zoom = map.getZoom();
      const radius = Math.max(14, Math.pow(1.5, zoom - 11) * 12);
      const bounds = map.getBounds();

      // Batch rendering by color to reduce state changes
      const bins: Record<string, { r: number, g: number, b: number, a: number, list: CoveragePoint[] }> = {
        'ex': { r: 34, g: 197, b: 94, a: 0.5, list: [] },
        'gd': { r: 132, g: 204, b: 22, a: 0.45, list: [] },
        'fr': { r: 234, g: 179, b: 8, a: 0.4, list: [] },
        'pr': { r: 249, g: 115, b: 22, a: 0.35, list: [] },
        'ns': { r: 220, g: 38, b: 38, a: 0.25, list: [] }
      };

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        // Spatial culling for viewport
        if (!bounds.contains([p.lat, p.lng])) continue;

        if (p.rsrp >= -75) bins.ex.list.push(p);
        else if (p.rsrp >= -90) bins.gd.list.push(p);
        else if (p.rsrp >= -105) bins.fr.list.push(p);
        else if (p.rsrp >= -115) bins.pr.list.push(p);
        else bins.ns.list.push(p);
      }

      Object.values(bins).forEach(bin => {
        if (bin.list.length === 0) return;
        ctx.fillStyle = `rgba(${bin.r}, ${bin.g}, ${bin.b}, ${bin.a})`;
        bin.list.forEach(p => {
          const pt = map.latLngToContainerPoint([p.lat, p.lng]);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    };

    render();
    map.on('moveend zoomend resize', render);
    return () => { map.off('moveend zoomend resize', render); };
  }, [points, map]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-[400]"
      style={{ filter: 'blur(8px)', opacity: 0.65 }}
    />
  );
};

export default Heatmap;
