
import { Site, Sector, AntennaModel, CoveragePoint, TowerType, PhoneDeviceState } from '../types';
import { ANTENNA_LIBRARY } from '../constants';

/**
 * Technical constants for RF Propagation
 */
const LIGHT_SPEED = 299792458;
const EARTH_RADIUS_KM = 6371;
const MAX_EFFECTIVE_RANGE_KM = 10.0;
const MAX_EFFECTIVE_RANGE_KM_SQ = MAX_EFFECTIVE_RANGE_KM * MAX_EFFECTIVE_RANGE_KM;

/**
 * Fast approximate distance squared in degrees (Local planar approximation)
 * Use this for initial pruning before expensive Haversine/Math.sin calls.
 */
const getQuickDistSq = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
};

/**
 * Synthetic Elevation Engine
 */
const getSyntheticElevation = (lat: number, lng: number): number => {
  const macro = Math.sin(lat * 800) * 45 + Math.cos(lng * 800) * 45;
  const micro = Math.sin(lat * 5000 + lng * 3000) * 12;
  return macro + micro;
};

export const getUrbanClutterLoss = (lat: number, lng: number): number => {
  const buildingX = Math.abs(Math.sin(lat * 7241)); 
  const buildingY = Math.abs(Math.sin(lng * 7122));
  if (buildingX < 0.3 && buildingY < 0.3) return 30;
  if (buildingX < 0.7 && buildingY < 0.7) return 15;
  return 0;
};

const calculateDiffractionLoss = (v: number): number => {
  if (v <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt(Math.pow(v - 0.1, 2) + 1) + v - 0.1);
};

/**
 * Optimized Hata-Okumura
 */
export const calculateHata = (distKm: number, freqMhz: number, hb: number, hm: number): number => {
  // Near-field fallback
  if (distKm < 0.01) return 32.44 + 20 * Math.log10(distKm || 0.01) + 20 * Math.log10(freqMhz);
  
  const logF = Math.log10(freqMhz);
  const logHb = Math.log10(hb);
  const aHm = (1.1 * logF - 0.7) * hm - (1.56 * logF - 0.8);
  
  // Base Hata formula for Urban area
  const baseLoss = 69.55 + 26.16 * logF - 13.82 * logHb - aHm + (44.9 - 6.55 * logHb) * Math.log10(distKm);
  return baseLoss;
};

export const calculateRSRP = (
  site: Site,
  sector: Sector,
  targetLat: number,
  targetLng: number,
  useTerrain: boolean = true
): number => {
  // PRUNING: Quick coordinate-based distance check (approx 1 degree ~ 111km)
  // 10km is roughly 0.09 degrees. 0.09^2 = 0.0081
  const quickDist = getQuickDistSq(site.lat, site.lng, targetLat, targetLng);
  if (quickDist > 0.01) return -150; 

  const antenna = ANTENNA_LIBRARY.find(a => a.id === sector.antennaId);
  if (!antenna) return -140;

  // Accurate distance for final calculation
  const dLat = (targetLat - site.lat) * (Math.PI / 180);
  const dLng = (targetLng - site.lng) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(site.lat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const distKm = EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  if (distKm > MAX_EFFECTIVE_RANGE_KM) return -150;

  const distM = distKm * 1000;
  const y = Math.sin(dLng) * Math.cos(targetLat * (Math.PI / 180));
  const x = Math.cos(site.lat * (Math.PI / 180)) * Math.sin(targetLat * (Math.PI / 180)) -
            Math.sin(site.lat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) * Math.cos(dLng);
  let angleDeg = (Math.atan2(y, x) * 180) / Math.PI;
  angleDeg = (angleDeg + 360) % 360;

  // Horizontal Pattern
  const horizAngleDiff = Math.abs(((angleDeg - sector.azimuth + 180) % 360) - 180);
  const horizLoss = Math.min(35, 12 * Math.pow(horizAngleDiff / (antenna.horizontalBeamwidth / 2), 2));

  // Vertical Pattern
  const heightDiff = (sector.heightM || site.towerHeightM) - 1.5;
  const verticalAngleToTarget = (Math.atan2(heightDiff, distM) * 180) / Math.PI;
  const effectiveTilt = (sector.mechanicalTilt || 0) + (sector.electricalTilt || 0);
  const vertAngleDiff = Math.abs(verticalAngleToTarget - effectiveTilt);
  const vertLoss = Math.min(25, 12 * Math.pow(vertAngleDiff / (antenna.verticalBeamwidth / 2), 2));

  const gainPattern = Math.max(-35, -(horizLoss + vertLoss));
  const pathLoss = calculateHata(distKm, sector.frequencyMhz, sector.heightM || site.towerHeightM, 1.5);
  
  let extraLoss = 0;
  if (useTerrain) {
    const txElev = getSyntheticElevation(site.lat, site.lng) + (sector.heightM || site.towerHeightM);
    const rxElev = getSyntheticElevation(targetLat, targetLng) + 1.5;
    const samples = 4; // Reduced samples for performance
    let maxV = -Infinity;

    for (let i = 1; i <= samples; i++) {
      const step = i / (samples + 1);
      const sampleLat = site.lat + (targetLat - site.lat) * step;
      const sampleLng = site.lng + (targetLng - site.lng) * step;
      const tHeight = getSyntheticElevation(sampleLat, sampleLng);
      const losHeight = txElev + (rxElev - txElev) * step;
      const d1 = distM * step;
      const d2 = distM * (1 - step);
      const wavelength = LIGHT_SPEED / (sector.frequencyMhz * 1e6);
      const v = (tHeight - losHeight) * Math.sqrt((2 * (d1 + d2)) / (wavelength * d1 * d2));
      if (v > maxV) maxV = v;
    }
    extraLoss += calculateDiffractionLoss(maxV);
  }

  const clutterLoss = getUrbanClutterLoss(targetLat, targetLng);
  return (sector.txPowerDbm || 43) + antenna.gainDbi + gainPattern - pathLoss - clutterLoss - extraLoss;
};

export const getBestRSRPAtPoint = (sites: Site[], lat: number, lng: number, useTerrain: boolean): number => {
  let bestRsrp = -150;
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    // Pruning: Skip sites that are logically too far
    const quickDist = getQuickDistSq(site.lat, site.lng, lat, lng);
    if (quickDist > 0.015) continue; 

    for (let j = 0; j < site.sectors.length; j++) {
      const rsrp = calculateRSRP(site, site.sectors[j], lat, lng, useTerrain);
      if (rsrp > bestRsrp) bestRsrp = rsrp;
    }
  }
  return bestRsrp;
};

/**
 * Smart Expansion Engine
 */
export const findOptimalNextSites = (sites: Site[]): {lat: number, lng: number, reason: string}[] => {
  if (sites.length === 0) return [];
  
  const lats = sites.map(s => s.lat);
  const lngs = sites.map(s => s.lng);
  const minLat = Math.min(...lats) - 0.04;
  const maxLat = Math.max(...lats) + 0.04;
  const minLng = Math.min(...lngs) - 0.04;
  const maxLng = Math.max(...lngs) + 0.04;

  const currentSites = [...sites];
  const suggestions: {lat: number, lng: number, reason: string}[] = [];
  const targetCount = 10;
  const steps = 30; 
  const latStep = (maxLat - minLat) / steps;
  const lngStep = (maxLng - minLng) / steps;

  for (let s = 0; s < targetCount; s++) {
    let bestHole: {lat: number, lng: number, score: number} | null = null;

    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const lat = minLat + i * latStep;
        const lng = minLng + j * lngStep;
        const rsrp = getBestRSRPAtPoint(currentSites, lat, lng, true);
        
        let minDistanceSq = Infinity;
        currentSites.forEach(sc => {
          const d2 = Math.pow(lat - sc.lat, 2) + Math.pow(lng - sc.lng, 2);
          if (d2 < minDistanceSq) minDistanceSq = d2;
        });

        const score = Math.max(0, -100 - rsrp) * (minDistanceSq < 0.00005 ? 0 : 1);

        if (!bestHole || score > bestHole.score) {
          bestHole = { lat, lng, score };
        }
      }
    }

    if (bestHole && bestHole.score > 0) {
      suggestions.push({ lat: bestHole.lat, lng: bestHole.lng, reason: "Coverage gap optimization." });
      currentSites.push({ id: `v-${s}`, lat: bestHole.lat, lng: bestHole.lng, sectors: [{ id: 's1', antennaId: ANTENNA_LIBRARY[0].id, azimuth: 0, mechanicalTilt: 0, electricalTilt: 6, txPowerDbm: 44, frequencyMhz: 1800, heightM: 30 }] } as any);
    }
  }
  return suggestions;
};

export const runSimulation = (sites: Site[], radiusKm: number, step: number, useTerrain: boolean = true): CoveragePoint[] => {
  const points: CoveragePoint[] = [];
  if (sites.length === 0) return points;

  const minLat = Math.min(...sites.map(s => s.lat)) - 0.1;
  const maxLat = Math.max(...sites.map(s => s.lat)) + 0.1;
  const minLng = Math.min(...sites.map(s => s.lng)) - 0.1;
  const maxLng = Math.max(...sites.map(s => s.lng)) + 0.1;

  // Optimized loop using site culling inside getBestRSRPAtPoint
  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lng = minLng; lng <= maxLng; lng += step) {
      const rsrp = getBestRSRPAtPoint(sites, lat, lng, useTerrain);
      if (rsrp > -120) points.push({ lat, lng, rsrp });
    }
  }
  return points;
};

export const getSyntheticHumanTraffic = (lat: number, lng: number): number => {
  const density = Math.abs(Math.sin(lat * 1500) * Math.cos(lng * 1500)) * 60 +
                  Math.abs(Math.sin(lat * 400) * Math.cos(lng * 400)) * 40;
  return Math.min(100, density);
};

export const optimizeSiteParameters = (site: Site, allSites: Site[], useTerrain: boolean): Sector[] => {
  const numSectors = 3;
  const spacing = 120;
  return Array.from({ length: numSectors }).map((_, index) => ({
    id: crypto.randomUUID(),
    antennaId: ANTENNA_LIBRARY[0].id,
    azimuth: (index * spacing) % 360,
    mechanicalTilt: 0,
    electricalTilt: 6,
    txPowerDbm: 44,
    frequencyMhz: 1800,
    heightM: site.towerHeightM - 2
  }));
};

export const getPhoneSignalProfile = (sites: Site[], lat: number, lng: number, useTerrain: boolean): Partial<PhoneDeviceState> => {
  const allSignals: Array<{ siteId: string; siteName: string; sectorId: string; rsrp: number }> = [];
  sites.forEach(site => {
    // Spatial pruning for phone probe
    if (getQuickDistSq(site.lat, site.lng, lat, lng) < 0.05) {
      site.sectors.forEach(sector => {
        allSignals.push({ siteId: site.id, siteName: site.name, sectorId: sector.id, rsrp: calculateRSRP(site, sector, lat, lng, useTerrain) });
      });
    }
  });
  allSignals.sort((a, b) => b.rsrp - a.rsrp);
  const serving = allSignals[0] || null;
  return {
    lat, lng,
    rsrp: serving ? serving.rsrp : -150,
    sinr: serving ? Math.min(30, serving.rsrp + 105) : -20,
    servingCellId: serving ? serving.sectorId : null,
    servingSiteName: serving ? serving.siteName : null,
    neighbors: allSignals.slice(1, 4).map(s => ({ siteName: s.siteName, rsrp: s.rsrp }))
  };
};
