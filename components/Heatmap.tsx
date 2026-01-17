
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
      canvas.width = size.x;
      canvas.height = size.y;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // PROFESSIONAL RSRP THRESHOLDS
      const getColor = (rsrp: number) => {
        // Excellent: >= -75
        if (rsrp >= -75) return { r: 34, g: 197, b: 94, a: 0.5 }; 
        // Good: -75 to -90
        if (rsrp >= -90) return { r: 132, g: 204, b: 22, a: 0.45 };
        // Fair: -90 to -105
        if (rsrp >= -105) return { r: 234, g: 179, b: 8, a: 0.4 };
        // Poor: -105 to -115
        if (rsrp >= -115) return { r: 249, g: 115, b: 22, a: 0.35 };
        // No Service: < -115
        return { r: 220, g: 38, b: 38, a: 0.25 };
      };

      const zoom = map.getZoom();
      const radius = Math.max(16, Math.pow(1.5, zoom - 11) * 14);

      ctx.globalCompositeOperation = 'source-over';

      points.forEach(p => {
        const screenPoint = map.latLngToContainerPoint([p.lat, p.lng]);
        
        if (screenPoint.x < -radius || screenPoint.x > canvas.width + radius || 
            screenPoint.y < -radius || screenPoint.y > canvas.height + radius) return;

        const { r, g, b, a } = getColor(p.rsrp);
        
        const grad = ctx.createRadialGradient(screenPoint.x, screenPoint.y, 0, screenPoint.x, screenPoint.y, radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${a * 0.6})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(screenPoint.x, screenPoint.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    render();
    map.on('move zoom resize', render);
    return () => { map.off('move zoom resize', render); };
  }, [points, map]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-[400]"
      style={{ 
        filter: 'blur(3px) brightness(1.1) contrast(1.1)', 
        opacity: 0.7
      }}
    />
  );
};

export default Heatmap;
