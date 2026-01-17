
import React, { useEffect, useRef } from 'react';
import { CoveragePoint } from '../types';
import L from 'leaflet';

interface Props {
  points: CoveragePoint[];
  map: L.Map | null;
}

/**
 * RF INDUSTRY COLOR RAMP (RSRP dBm)
 * Excellent: > -75 (Cyan/Blue)
 * Good: -75 to -85 (Green)
 * Fair: -85 to -95 (Yellow/Gold)
 * Poor: -95 to -105 (Orange)
 * Critical: -105 to -115 (Red)
 */
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

      // We use a screen-space grid to aggregate points
      // This creates a "Pixelated Carpet" look common in professional RF tools
      const gridSize = zoom > 15 ? 12 : zoom > 13 ? 8 : 6;
      const cols = Math.ceil(canvas.width / gridSize);
      const rows = Math.ceil(canvas.height / gridSize);
      
      // Buffer to store the best signal for each grid cell
      const grid = new Float32Array(cols * rows).fill(-150);

      // 1. PROJECT: Map lat/lng points to the screen-space grid
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!bounds.contains([p.lat, p.lng])) continue;

        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        const gx = Math.floor(pt.x / gridSize);
        const gy = Math.floor(pt.y / gridSize);

        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
          const idx = gy * cols + gx;
          // Keep only the dominant (strongest) signal for this grid cell
          if (p.rsrp > grid[idx]) {
            grid[idx] = p.rsrp;
          }
        }
      }

      // 2. RENDER: Draw the grid cells
      // We don't blur here to maintain technical accuracy of the "bins"
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const rsrp = grid[y * cols + x];
          if (rsrp <= -115) continue;

          const color = getRFColor(rsrp);
          
          // Map RSRP to alpha for smooth edge fading
          // Stronger signals are more solid
          const alpha = Math.min(0.7, (rsrp + 115) / 40 + 0.1);
          
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
          ctx.fillRect(x * gridSize, y * gridSize, gridSize + 0.5, gridSize + 0.5);
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
        mixBlendMode: 'multiply', // This helps the signal "blend" with the terrain features
        imageRendering: 'pixelated' // Keeps it looking like a technical grid
      }}
    />
  );
};

export default Heatmap;
