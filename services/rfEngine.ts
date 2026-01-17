
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

/**
 * Intelligent Azimuth Optimization
 * Analyzes neighbors and points sectors away from interference and toward coverage nulls.
 */
export const optimizeSiteParameters = (site: Site, allSites: Site[], useTerrain: boolean): Sector[] => {
  const sectors = site.sectors.map(s => ({ ...s }));
  if (sectors.length === 0) return [];

  // 1. Calculate the 'Steering' Azimuth
  // Look for the direction with the worst existing coverage within 1km
  let worstAzimuth = 0;
  let minRsrp = Infinity;
  const searchSteps = 12;
  const radius = 0.005; // ~500m search radius

  for (let i = 0; i < searchSteps; i++) {
    const ang = (i * 360) / searchSteps;
    const rad = (ang * Math.PI) / 180;
    const testLat = site.lat + radius * Math.cos(rad);
    const testLng = site.lng + radius * Math.sin(rad);
    
    // Ignore current site's own contribution to find the hole
    const rsrp = getBestRSRPAtPoint(allSites.filter(s => s.id !== site.id), testLat, testLng, useTerrain);
    if (rsrp < minRsrp) {
      minRsrp = rsrp;
      worstAzimuth = ang;
    }
  }

  // 2. Adjust for Neighbor Interference
  // Find neighbors within 2km and calculate vectors to them
  const neighbors = allSites
    .filter(s => s.id !== site.id)
    .filter(s => getQuickDistSq(s.lat, s.lng, site.lat, site.lng) < 0.0004); // ~2km

  const spacing = 360 / sectors.length;
  sectors.forEach((s, i) => {
    // Primary sector points to the worst hole found
    s.azimuth = Math.round((worstAzimuth + i * spacing) % 360);

    // Dynamic Tilt
    const traffic = getSyntheticHumanTraffic(site.lat, site.lng);
    let targetTilt = 4;
    if (traffic > 70) targetTilt = 8;
    else if (traffic > 40) targetTilt = 6;
    if (site.towerHeightM > 40) targetTilt += 2;
    
    s.electricalTilt = targetTilt;
    s.mechanicalTilt = 0;
  });

  return sectors;
};

/**
 * AI Site Search with Mesh Continuity Logic
 * Prioritizes bridging service gaps rather than just identifying isolated holes.
 */
export const findOptimalNextSites = (sites: Site[]): {lat: number, lng: number, reason: string, sectors: Sector[]}[] => {
  if (sites.length === 0) return [];
  const lats = sites.map(s => s.lat), lngs = sites.map(s => s.lng);
  
  // Expand search area slightly more for the 20-site suggestion
  const minLat = Math.min(...lats) - 0.08, maxLat = Math.max(...lats) + 0.08;
  const minLng = Math.min(...lngs) - 0.08, maxLng = Math.max(...lngs) + 0.08;
  
  const currentSites = [...sites];
  const suggestions: any[] = [];
  const steps = 40; // Higher granularity for 20 suggestions

  // Loop 20 times to provide at least 20 site locations as requested
  for (let s = 0; s < 20; s++) {
    let bestCandidate: {lat: number, lng: number, score: number, traffic: number, meshContinuity: number} | null = null;
    
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

        // Continuity Factor: favors points that are at the edge of existing signal (-100 to -115 dBm)
        // rather than points with NO signal at all. This bridges gaps for continuous service.
        const meshContinuity = (rsrp > -118 && rsrp < -102) ? 60 : 0;
        
        // Final score logic:
        // Coverage Need (how bad is it?) + Continuity Need (is it bridgeable?) + Traffic demand
        // minD2 check (0.00003 ~300m) ensures we don't stack towers too close
        const coverageDeficit = Math.max(0, -100 - rsrp);
        const score = (coverageDeficit * 1.8 + meshContinuity + traffic * 0.3) * (minD2 < 0.00003 ? 0 : 1);

        if (!bestCandidate || score > bestCandidate.score) {
          bestCandidate = { lat, lng, score, traffic, meshContinuity };
        }
      }
    }
    
    if (bestCandidate && bestCandidate.score > 15) {
      const isContinuityFocus = bestCandidate.meshContinuity > 0;
      
      const tempSite: Site = {
        id: `sug-${suggestions.length}`,
        name: isContinuityFocus ? `Continuity Node ${s + 1}` : `Expansion Node ${s + 1}`,
        lat: bestCandidate.lat,
        lng: bestCandidate.lng,
        towerHeightM: 30,
        towerType: TowerType.MONOPOLE,
        status: 'planned',
        sectors: [
          { id: 's1', antennaId: ANTENNA_LIBRARY[0].id, azimuth: 0, mechanicalTilt: 0, electricalTilt: 6, txPowerDbm: 44, frequencyMhz: 1800, heightM: 30 },
          { id: 's2', antennaId: ANTENNA_LIBRARY[0].id, azimuth: 120, mechanicalTilt: 0, electricalTilt: 6, txPowerDbm: 44, frequencyMhz: 1800, heightM: 30 },
          { id: 's3', antennaId: ANTENNA_LIBRARY[0].id, azimuth: 240, mechanicalTilt: 0, electricalTilt: 6, txPowerDbm: 44, frequencyMhz: 1800, heightM: 30 }
        ]
      };
      
      const optimizedSectors = optimizeSiteParameters(tempSite, currentSites, true);
      suggestions.push({ 
        lat: bestCandidate.lat, 
        lng: bestCandidate.lng, 
        reason: isContinuityFocus ? "Signal Continuity Bridge" : (bestCandidate.traffic > 65 ? "High-Traffic Capacity Node" : "Edge Coverage Extension"),
        sectors: optimizedSectors
      });
      
      currentSites.push({ ...tempSite, sectors: optimizedSectors } as any);
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
