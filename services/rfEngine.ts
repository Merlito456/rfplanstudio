
import { Site, Sector, AntennaModel, CoveragePoint, TowerType, PhoneDeviceState } from '../types';
import { ANTENNA_LIBRARY } from '../constants';

/**
 * Technical constants for RF Propagation
 */
const LIGHT_SPEED = 299792458;
const EARTH_RADIUS_KM = 6371;

/**
 * Synthetic Elevation Engine (Simulating complex terrain)
 */
const getSyntheticElevation = (lat: number, lng: number): number => {
  const macro = Math.sin(lat * 800) * 45 + Math.cos(lng * 800) * 45;
  const micro = Math.sin(lat * 5000 + lng * 3000) * 12;
  const ridges = Math.pow(Math.abs(Math.sin(lat * 2000)), 2) * 20;
  return macro + micro + ridges;
};

/**
 * Clutter / Obstruction Data (Synthetic Raster)
 */
export const getUrbanClutterLoss = (lat: number, lng: number): number => {
  const buildingX = Math.abs(Math.sin(lat * 7241)); 
  const buildingY = Math.abs(Math.sin(lng * 7122));
  const isDenseUrban = buildingX < 0.3 && buildingY < 0.3;
  const isUrban = buildingX < 0.7 && buildingY < 0.7;
  
  if (isDenseUrban) return 30; // Dense Urban
  if (isUrban) return 15;      // Urban
  return 0;                    // Open/Suburban
};

/**
 * Knife-Edge Diffraction Loss (ITU-R P.526-15 simplified)
 */
const calculateDiffractionLoss = (v: number): number => {
  if (v <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt(Math.pow(v - 0.1, 2) + 1) + v - 0.1);
};

/**
 * Fresnel Zone Calculation
 */
const calculateFresnelRadius = (dist1M: number, dist2M: number, freqMhz: number): number => {
  const wavelength = LIGHT_SPEED / (freqMhz * 1e6);
  const totalDistM = dist1M + dist2M;
  return Math.sqrt((wavelength * dist1M * dist2M) / totalDistM);
};

export const calculateHata = (distKm: number, freqMhz: number, hb: number, hm: number): number => {
  if (distKm < 0.01) return 32.44 + 20 * Math.log10(distKm || 0.01) + 20 * Math.log10(freqMhz);
  const aHm = (1.1 * Math.log10(freqMhz) - 0.7) * hm - (1.56 * Math.log10(freqMhz) - 0.8);
  const baseLoss = 69.55 + 26.16 * Math.log10(freqMhz) - 13.82 * Math.log10(hb) - aHm + (44.9 - 6.55 * Math.log10(hb)) * Math.log10(distKm);
  return baseLoss;
};

export const calculateRSRP = (
  site: Site,
  sector: Sector,
  targetLat: number,
  targetLng: number,
  useTerrain: boolean = true
): number => {
  const antenna = ANTENNA_LIBRARY.find(a => a.id === sector.antennaId);
  if (!antenna) return -140;

  const dLat = (targetLat - site.lat) * (Math.PI / 180);
  const dLng = (targetLng - site.lng) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(site.lat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = EARTH_RADIUS_KM * c;
  const distM = distKm * 1000;

  if (distKm > 10) return -150; 

  const y = Math.sin(dLng) * Math.cos(targetLat * (Math.PI / 180));
  const x = Math.cos(site.lat * (Math.PI / 180)) * Math.sin(targetLat * (Math.PI / 180)) -
            Math.sin(site.lat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) * Math.cos(dLng);
  let angleDeg = (Math.atan2(y, x) * 180) / Math.PI;
  angleDeg = (angleDeg + 360) % 360;

  const horizAngleDiff = Math.abs(((angleDeg - sector.azimuth + 180) % 360) - 180);
  const FBR = 35; 
  const horizLoss = Math.min(FBR, 12 * Math.pow(horizAngleDiff / (antenna.horizontalBeamwidth / 2), 2));

  const heightDiff = (sector.heightM || site.towerHeightM) - 1.5;
  const verticalAngleToTarget = (Math.atan2(heightDiff, distM) * 180) / Math.PI;
  const effectiveTilt = (sector.mechanicalTilt || 0) + (sector.electricalTilt || 0);
  const vertAngleDiff = Math.abs(verticalAngleToTarget - effectiveTilt);
  const vertLoss = Math.min(25, 12 * Math.pow(vertAngleDiff / (antenna.verticalBeamwidth / 2), 2));

  const antennaGainPattern = Math.max(-FBR, -(horizLoss + vertLoss));
  const basicPathLoss = calculateHata(distKm, sector.frequencyMhz, sector.heightM || site.towerHeightM, 1.5);
  
  let extraLoss = 0;
  if (useTerrain) {
    const txElev = getSyntheticElevation(site.lat, site.lng) + (sector.heightM || site.towerHeightM);
    const rxElev = getSyntheticElevation(targetLat, targetLng) + 1.5;
    const samples = 6;
    let maxV = -Infinity;
    let worstFresnelClearance = 1.0;

    for (let i = 1; i <= samples; i++) {
      const step = i / (samples + 1);
      const sampleLat = site.lat + (targetLat - site.lat) * step;
      const sampleLng = site.lng + (targetLng - site.lng) * step;
      const tHeight = getSyntheticElevation(sampleLat, sampleLng);
      const losHeight = txElev + (rxElev - txElev) * step;
      const d1 = distM * step;
      const d2 = distM * (1 - step);
      const h = tHeight - losHeight;
      const wavelength = LIGHT_SPEED / (sector.frequencyMhz * 1e6);
      const v = h * Math.sqrt((2 * (d1 + d2)) / (wavelength * d1 * d2));
      if (v > maxV) maxV = v;
      const f1Radius = calculateFresnelRadius(d1, d2, sector.frequencyMhz);
      const clearance = (losHeight - tHeight) / f1Radius;
      if (clearance < worstFresnelClearance) worstFresnelClearance = clearance;
    }

    extraLoss += calculateDiffractionLoss(maxV);
    if (worstFresnelClearance < 0.6) {
      extraLoss += (0.6 - Math.max(-1, worstFresnelClearance)) * 15;
    }
  }

  const clutterLoss = getUrbanClutterLoss(targetLat, targetLng);
  return (sector.txPowerDbm || 43) + antenna.gainDbi + antennaGainPattern - basicPathLoss - clutterLoss - extraLoss;
};

export const getBestRSRPAtPoint = (sites: Site[], lat: number, lng: number, useTerrain: boolean): number => {
  let bestRsrp = -150;
  sites.forEach(site => {
    site.sectors.forEach(sector => {
      const rsrp = calculateRSRP(site, sector, lat, lng, useTerrain);
      if (rsrp > bestRsrp) bestRsrp = rsrp;
    });
  });
  return bestRsrp;
};

/**
 * Smart Offline Planning Engine:
 * Implements a Greedy Iterative Multi-Objective Search for 10 optimal sites.
 * Targets:
 * 1. Coverage Holes (RSRP < -105 dBm)
 * 2. High Density Areas (Synthetic Traffic)
 * 3. Signal Quality improvement (Reducing interference overlap)
 */
export const findOptimalNextSites = (sites: Site[]): {lat: number, lng: number, reason: string}[] => {
  if (sites.length === 0) {
    // Return a default grid if no sites exist
    return Array.from({ length: 10 }).map((_, i) => ({
      lat: 40.7128 + (Math.random() - 0.5) * 0.05,
      lng: -74.0060 + (Math.random() - 0.5) * 0.05,
      reason: "Initial network deployment target."
    }));
  }
  
  const lats = sites.map(s => s.lat);
  const lngs = sites.map(s => s.lng);
  const minLat = Math.min(...lats) - 0.04;
  const maxLat = Math.max(...lats) + 0.04;
  const minLng = Math.min(...lngs) - 0.04;
  const maxLng = Math.max(...lngs) + 0.04;

  const currentSites = [...sites];
  const suggestions: {lat: number, lng: number, reason: string}[] = [];
  const targetCount = 10;
  const steps = 40; // High resolution search grid
  const latStep = (maxLat - minLat) / steps;
  const lngStep = (maxLng - minLng) / steps;

  for (let s = 0; s < targetCount; s++) {
    let bestHole: {lat: number, lng: number, score: number, traffic: number, rsrp: number} | null = null;

    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const lat = minLat + i * latStep;
        const lng = minLng + j * lngStep;
        
        const rsrp = getBestRSRPAtPoint(currentSites, lat, lng, true);
        const traffic = getSyntheticHumanTraffic(lat, lng);
        
        // Repulsion Logic: Don't place sites too close to each other (Existing or Suggested)
        let minDistanceSq = Infinity;
        currentSites.forEach(sc => {
          const d2 = Math.pow(lat - sc.lat, 2) + Math.pow(lng - sc.lng, 2);
          if (d2 < minDistanceSq) minDistanceSq = d2;
        });
        suggestions.forEach(sc => {
          const d2 = Math.pow(lat - sc.lat, 2) + Math.pow(lng - sc.lng, 2);
          if (d2 < minDistanceSq) minDistanceSq = d2;
        });

        // Scoring Function
        // - Priority 1: Coverage Holes (RSRP < -100)
        // - Priority 2: High Traffic Demand
        // - Constraint: Distance (repulsion)
        const holeDepth = Math.max(0, -100 - rsrp);
        const trafficWeight = traffic * 0.5;
        const coverageWeight = holeDepth * 2.0;
        
        // Strong penalty if within ~500m of another site (approx 0.005 degrees)
        const proximityPenalty = minDistanceSq < 0.00002 ? 0 : 1;
        const score = (coverageWeight + trafficWeight) * proximityPenalty;

        if (!bestHole || score > bestHole.score) {
          bestHole = { lat, lng, score, traffic, rsrp };
        }
      }
    }

    if (bestHole && bestHole.score > 0) {
      let reason = "";
      if (bestHole.rsrp < -110) {
        reason = "Critical dead zone identified. Essential for basic network continuity.";
      } else if (bestHole.traffic > 70) {
        reason = "High capacity demand area. Deploying to offload neighboring cells.";
      } else {
        reason = "Strategic fill-in for signal quality and indoor penetration improvement.";
      }
      
      suggestions.push({ lat: bestHole.lat, lng: bestHole.lng, reason });

      // Add a virtual "Macro Hub" at this location to update the coverage map for the next greedy step
      const virtualSite: Site = {
        id: `virtual-${s}`,
        name: 'Virtual Node',
        lat: bestHole.lat,
        lng: bestHole.lng,
        towerHeightM: 35,
        towerType: TowerType.LATTICE,
        status: 'planned',
        sectors: [
          { id: 'v1', antennaId: ANTENNA_LIBRARY[0].id, azimuth: 0, mechanicalTilt: 0, electricalTilt: 6, txPowerDbm: 44, frequencyMhz: 1800, heightM: 33 },
          { id: 'v2', antennaId: ANTENNA_LIBRARY[0].id, azimuth: 120, mechanicalTilt: 0, electricalTilt: 6, txPowerDbm: 44, frequencyMhz: 1800, heightM: 33 },
          { id: 'v3', antennaId: ANTENNA_LIBRARY[0].id, azimuth: 240, mechanicalTilt: 0, electricalTilt: 6, txPowerDbm: 44, frequencyMhz: 1800, heightM: 33 }
        ]
      };
      currentSites.push(virtualSite);
    } else {
      // If we can't find a good hole, pick a slightly randomized spot at the edge of the cluster
      const angle = Math.random() * Math.PI * 2;
      const dist = 0.03;
      suggestions.push({
        lat: minLat + Math.random() * (maxLat - minLat),
        lng: minLng + Math.random() * (maxLng - minLng),
        reason: "Boundary extension to support future area expansion."
      });
    }
  }

  return suggestions;
};

export const optimizeSiteParameters = (site: Site, allSites: Site[], useTerrain: boolean): Sector[] => {
  const numSectors = site.sectors.length || 3;
  const spacing = 360 / numSectors;
  return Array.from({ length: numSectors }).map((_, index) => ({
    id: crypto.randomUUID(),
    antennaId: site.sectors[index]?.antennaId || ANTENNA_LIBRARY[0].id,
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
    site.sectors.forEach(sector => {
      allSignals.push({ siteId: site.id, siteName: site.name, sectorId: sector.id, rsrp: calculateRSRP(site, sector, lat, lng, useTerrain) });
    });
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

export const runSimulation = (sites: Site[], radiusKm: number, step: number, useTerrain: boolean = true): CoveragePoint[] => {
  const points: CoveragePoint[] = [];
  if (sites.length === 0) return points;
  const minLat = Math.min(...sites.map(s => s.lat)) - 0.12;
  const maxLat = Math.max(...sites.map(s => s.lat)) + 0.12;
  const minLng = Math.min(...sites.map(s => s.lng)) - 0.12;
  const maxLng = Math.max(...sites.map(s => s.lng)) + 0.12;
  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lng = minLng; lng <= maxLng; lng += step) {
      const rsrp = getBestRSRPAtPoint(sites, lat, lng, useTerrain);
      if (rsrp > -120) points.push({ lat, lng, rsrp });
    }
  }
  return points;
};

/**
 * Synthetic human traffic simulation:
 * Generates higher density near center coordinates and randomized clusters.
 */
export const getSyntheticHumanTraffic = (lat: number, lng: number): number => {
  const density = Math.abs(Math.sin(lat * 1500) * Math.cos(lng * 1500)) * 60 +
                  Math.abs(Math.sin(lat * 400) * Math.cos(lng * 400)) * 40;
  return Math.min(100, density);
};
