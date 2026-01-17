
import React, { useEffect, useRef } from 'react';
import { CoveragePoint } from '../types';
import L from 'leaflet';

interface Props {
  points: CoveragePoint[];
  step: number; // Geographical step in degrees
  map: L.Map | null;
}

/**
 * Technical RF Signal Color Bins
 * Discrete bands provide better technical "differentiation" for engineering.
 */
const getRFColor = (rsrp: number) => {
  if (rsrp >= -75) return { r: 0, g: 180, b: 255 };  // Excellent (Cyan)
  if (rsrp >= -85) return { r: 34, g: 197, b: 94 };  // Good (Green)
  if (rsrp >= -95) return { r: 234, g: 179, b: 8 };  // Fair (Yellow)
  if (rsrp >= -105) return { r: 249, g: 115, b: 22 }; // Poor (Orange)
  if (rsrp >= -115) return { r: 220, g: 38, b: 38 };  // Critical (Red)
  return null;
};

const Heatmap: React.FC<Props> = ({ points, step, map }) => {
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

      const bounds = map.getBounds();
      
      // Calculate how many pixels the "step" represents on screen
      // This ensures the "carpet" covers all gaps regardless of zoom
      const p1 = map.latLngToContainerPoint(bounds.getNorthWest());
      const p2 = map.latLngToContainerPoint([bounds.getNorth() - step, bounds.getWest() + step]);
      
      const pixelW = Math.abs(p2.x - p1.x) + 0.5; // Width of one "cell" in pixels
      const pixelH = Math.abs(p2.y - p1.y) + 0.5; // Height of one "cell" in pixels

      // Use a buffer to draw efficiently
      points.forEach(p => {
        if (!bounds.contains([p.lat, p.lng])) return;

        const color = getRFColor(p.rsrp);
        if (!color) return;

        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        
        // Stronger signals should be more solid/opaque to stand out
        const alpha = p.rsrp >= -85 ? 0.8 : p.rsrp >= -105 ? 0.6 : 0.4;

        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        
        // Draw centered at point
        // We slightly overlap (pixelW+1) to ensure no hairline cracks appear
        ctx.fillRect(
          Math.floor(pt.x - pixelW / 2), 
          Math.floor(pt.y - pixelH / 2), 
          Math.ceil(pixelW + 0.8), 
          Math.ceil(pixelH + 0.8)
        );
      });
    };

    render();
    map.on('moveend zoomend resize', render);
    return () => { map.off('moveend zoomend resize', render); };
  }, [points, step, map]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-[400]"
      style={{ 
        mixBlendMode: 'multiply',
        imageRendering: 'pixelated'
      }}
    />
  );
};

export default Heatmap;
