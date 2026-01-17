
import { Site, Sector, AntennaModel, CoveragePoint, TowerType, PhoneDeviceState } from '../types';
import { ANTENNA_LIBRARY } from '../constants';

/**
 * Technical constants for RF Propagation
 */
const LIGHT_SPEED = 299792458;
const EARTH_RADIUS_KM = 6371;
const MAX_EFFECTIVE_RANGE_KM = 12.0;

/**
 * Fast approximate distance squared in degrees
 */
const getQuickDistSq = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
};

/**
 * Elevation Engine
 */
const getSyntheticElevation = (lat: number, lng: number): number => {
  return Math.sin(lat * 800) * 45 + Math.cos(lng * 800) * 45 + Math.sin(lat * 5000 + lng * 3000) * 12;
};

export const getUrbanClutterLoss = (lat: number, lng: number): number => {
  const bx = Math.abs(Math.sin(lat * 7241)); 
  const by = Math.abs(Math.sin(lng * 7122));
  if (bx < 0.3 && by < 0.3) return 30; // Dense
  if (bx < 0.7 && by < 0.7) return 15; // Urban
  return 0;
};

const calculateDiffractionLoss = (v: number): number => {
  if (v <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt(Math.pow(v - 0.1, 2) + 1) + v - 0.1);
};

export const calculateHata = (distKm: number, freqMhz: number, hb: number, hm: number): number => {
  if (distKm < 0.01) return 32.44 + 20 * Math.log10(distKm || 0.01) + 20 * Math.log10(freqMhz);
  const logF = Math.log10(freqMhz);
  const logHb = Math.log10(hb);
  const aHm = (1.1 * logF - 0.7) * hm - (1.56 * logF - 0.8);
  return 69.55 + 26.16 * logF - 13.82 * logHb - aHm + (44.9 - 6.55 * logHb) * Math.log10(distKm);
};

export const calculateRSRP = (
  site: Site,
  sector: Sector,
  targetLat: number,
  targetLng: number,
  useTerrain: boolean = true
): number => {
  // Pruning: skip sites beyond ~12km
  if (getQuickDistSq(site.lat, site.lng, targetLat, targetLng) > 0.015) return -150; 

  const antenna = ANTENNA_LIBRARY.find(a => a.id === sector.antennaId);
  if (!antenna) return -140;

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

  const horizAngleDiff = Math.abs(((angleDeg - sector.azimuth + 180) % 360) - 180);
  const horizLoss = Math.min(35, 12 * Math.pow(horizAngleDiff / (antenna.horizontalBeamwidth / 2), 2));

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
    const samples = 4;
    let maxV = -Infinity;
    for (let i = 1; i <= samples; i++) {
      const step = i / (samples + 1);
      const tHeight = getSyntheticElevation(site.lat + (targetLat - site.lat) * step, site.lng + (targetLng - site.lng) * step);
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
    if (getQuickDistSq(site.lat, site.lng, lat, lng) > 0.015) continue; 
    for (let j = 0; j < site.sectors.length; j++) {
      const rsrp = calculateRSRP(site, site.sectors[j], lat, lng, useTerrain);
      if (rsrp > bestRsrp) bestRsrp = rsrp;
    }
  }
  return bestRsrp;
};

// Fix: Implement missing optimizeSiteParameters to resolve SiteDetails.tsx error
/**
 * Optimizes sector parameters for a specific site based on height and local traffic density.
 */
export const optimizeSiteParameters = (site: Site, allSites: Site[], useTerrain: boolean): Sector[] => {
  const sectors = site.sectors.map(s => ({ ...s }));
  if (sectors.length === 0) return [];

  // 1. Optimize Azimuths: Distribute evenly if they seem unconfigured (all 0)
  const allZero = sectors.every(s => s.azimuth === 0);
  if (allZero && sectors.length > 0) {
    const spacing = 360 / sectors.length;
    sectors.forEach((s, i) => {
      s.azimuth = Math.round(i * spacing);
    });
  }

  // 2. Optimize Tilts based on site height and local environment density
  const traffic = getSyntheticHumanTraffic(site.lat, site.lng);
  
  sectors.forEach(s => {
    // More traffic usually means smaller cells are needed -> more tilt to limit cell size
    let targetTilt = 4;
    if (traffic > 70) targetTilt = 8;
    else if (traffic > 40) targetTilt = 6;
    
    // Tower height compensation: higher towers need more tilt to avoid overshooting nearby subscribers
    if (site.towerHeightM > 40) targetTilt += 2;
    
    s.electricalTilt = targetTilt;
    s.mechanicalTilt = 0; 
    
    // Frequency adjustment: higher frequencies have higher propagation loss, might need slightly less tilt
    if (s.frequencyMhz > 2100) {
        s.electricalTilt = Math.max(2, s.electricalTilt - 1);
    }
  });

  return sectors;
};

export const findOptimalNextSites = (sites: Site[]): {lat: number, lng: number, reason: string}[] => {
  if (sites.length === 0) return [];
  const lats = sites.map(s => s.lat), lngs = sites.map(s => s.lng);
  const minLat = Math.min(...lats) - 0.04, maxLat = Math.max(...lats) + 0.04;
  const minLng = Math.min(...lngs) - 0.04, maxLng = Math.max(...lngs) + 0.04;
  const currentSites = [...sites], suggestions: {lat: number, lng: number, reason: string}[] = [];
  const steps = 30; 

  for (let s = 0; s < 10; s++) {
    let bestHole: {lat: number, lng: number, score: number, traffic: number} | null = null;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const lat = minLat + i * ((maxLat - minLat) / steps);
        const lng = minLng + j * ((maxLng - minLng) / steps);
        const rsrp = getBestRSRPAtPoint(currentSites, lat, lng, true);
        const traffic = getSyntheticHumanTraffic(lat, lng);
        let minD2 = Infinity;
        currentSites.forEach(sc => {
          const d2 = Math.pow(lat - sc.lat, 2) + Math.pow(lng - sc.lng, 2);
          if (d2 < minD2) minD2 = d2;
        });
        suggestions.forEach(sc => {
          const d2 = Math.pow(lat - sc.lat, 2) + Math.pow(lng - sc.lng, 2);
          if (d2 < minD2) minD2 = d2;
        });
        const score = (Math.max(0, -100 - rsrp) * 2 + traffic * 0.5) * (minD2 < 0.00004 ? 0 : 1);
        if (!bestHole || score > bestHole.score) bestHole = { lat, lng, score, traffic };
      }
    }
    if (bestHole && bestHole.score > 0) {
      suggestions.push({ lat: bestHole.lat, lng: bestHole.lng, reason: bestHole.traffic > 60 ? "Capacity Expansion" : "Coverage Optimization" });
      currentSites.push({ id: `v-${s}`, lat: bestHole.lat, lng: bestHole.lng, sectors: [{ id: 's1', antennaId: ANTENNA_LIBRARY[0].id, azimuth: 0, mechanicalTilt: 0, electricalTilt: 6, txPowerDbm: 44, frequencyMhz: 1800, heightM: 30 }] } as any);
    }
  }
  return suggestions;
};

export const getSyntheticHumanTraffic = (lat: number, lng: number): number => {
  return Math.min(100, Math.abs(Math.sin(lat * 1500) * Math.cos(lng * 1500)) * 60 + Math.abs(Math.sin(lat * 400) * Math.cos(lng * 400)) * 40);
};

export const getPhoneSignalProfile = (sites: Site[], lat: number, lng: number, useTerrain: boolean): Partial<PhoneDeviceState> => {
  const allSignals: Array<{ siteId: string; siteName: string; sectorId: string; rsrp: number }> = [];
  sites.forEach(site => {
    if (getQuickDistSq(site.lat, site.lng, lat, lng) < 0.05) {
      site.sectors.forEach(sector => {
        allSignals.push({ siteId: site.id, siteName: site.name, sectorId: sector.id, rsrp: calculateRSRP(site, sector, lat, lng, useTerrain) });
      });
    }
  });
  allSignals.sort((a, b) => b.rsrp - a.rsrp);
  const serving = allSignals[0] || null;
  return { lat, lng, rsrp: serving ? serving.rsrp : -150, sinr: serving ? Math.min(30, serving.rsrp + 105) : -20, servingCellId: serving ? serving.sectorId : null, servingSiteName: serving ? serving.siteName : null, neighbors: allSignals.slice(1, 4).map(s => ({ siteName: s.siteName, rsrp: s.rsrp })) };
};

export const runSimulation = (sites: Site[], radiusKm: number, step: number, useTerrain: boolean = true): CoveragePoint[] => {
  const points: CoveragePoint[] = [];
  if (sites.length === 0) return points;
  const lats = sites.map(s => s.lat), lngs = sites.map(s => s.lng);
  const minLat = Math.min(...lats) - 0.1, maxLat = Math.max(...lats) + 0.1;
  const minLng = Math.min(...lngs) - 0.1, maxLng = Math.max(...lngs) + 0.1;

  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lng = minLng; lng <= maxLng; lng += step) {
      const rsrp = getBestRSRPAtPoint(sites, lat, lng, useTerrain);
      if (rsrp > -120) points.push({ lat, lng, rsrp });
    }
  }
  return points;
};
