
import React, { useEffect, useRef } from 'react';
import { CoveragePoint } from '../types';
import L from 'leaflet';

interface Props {
  points: CoveragePoint[];
  map: L.Map | null;
}

const getRFColor = (rsrp: number) => {
  if (rsrp >= -75) return { r: 0, g: 180, b: 255 };  // Cyan
  if (rsrp >= -85) return { r: 34, g: 197, b: 94 };  // Green
  if (rsrp >= -95) return { r: 234, g: 179, b: 8 };  // Yellow
  if (rsrp >= -105) return { r: 249, g: 115, b: 22 }; // Orange
  if (rsrp >= -115) return { r: 220, g: 38, b: 38 };  // Red
  return { r: 0, g: 0, b: 0 };
};

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
      const bounds = map.getBounds();

      // Increased resolution for better sector visibility
      const gridSize = zoom > 15 ? 10 : zoom > 13 ? 6 : 4;
      const cols = Math.ceil(canvas.width / gridSize);
      const rows = Math.ceil(canvas.height / gridSize);
      
      const grid = new Float32Array(cols * rows).fill(-150);

      // Populate grid with strongest signal
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!bounds.contains([p.lat, p.lng])) continue;

        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        const gx = Math.floor(pt.x / gridSize);
        const gy = Math.floor(pt.y / gridSize);

        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
          const idx = gy * cols + gx;
          if (p.rsrp > grid[idx]) grid[idx] = p.rsrp;
        }
      }

      // Draw grid cells with industry color ramp
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const rsrp = grid[y * cols + x];
          if (rsrp <= -115) continue;

          const color = getRFColor(rsrp);
          // Strong signals are nearly opaque, weak signals fade out
          const alpha = Math.min(0.75, (rsrp + 115) / 45 + 0.15);
          
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
          // Draw slightly larger than grid to avoid "gaps" between pixels
          ctx.fillRect(x * gridSize - 0.5, y * gridSize - 0.5, gridSize + 1, gridSize + 1);
        }
      }
    };

    render();
    map.on('moveend zoomend resize', render);
    return () => { map.off('moveend zoomend resize', render); };
  }, [points, map]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-[400]"
      style={{ 
        mixBlendMode: 'multiply',
        imageRendering: 'crisp-edges'
      }}
    />
  );
};

export default Heatmap;
