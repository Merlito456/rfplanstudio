
import { AntennaModel, TowerType } from './types';

export const ANTENNA_LIBRARY: AntennaModel[] = [
  // --- HUAWEI (Specific Models & Series) ---
  { id: 'h-amb4519', vendor: 'Huawei', model: 'AMB4519R13v06', gainDbi: 18.5, horizontalBeamwidth: 65, verticalBeamwidth: 6.5, frequencyRange: [690, 2690], weightKg: 35, ports: 14 },
  { id: 'h-ape4518', vendor: 'Huawei', model: 'APE4518R47v06', gainDbi: 17.8, horizontalBeamwidth: 65, verticalBeamwidth: 7.2, frequencyRange: [790, 2170], weightKg: 28, ports: 10 },
  { id: 'h-ape4517', vendor: 'Huawei', model: 'APE4517R16v06', gainDbi: 18.2, horizontalBeamwidth: 65, verticalBeamwidth: 6.8, frequencyRange: [1710, 2690], weightKg: 22, ports: 8 },
  { id: 'h-a094519', vendor: 'Huawei', model: 'A094519R3v06', gainDbi: 19.1, horizontalBeamwidth: 65, verticalBeamwidth: 5.5, frequencyRange: [1710, 2690], weightKg: 31, ports: 12 },
  { id: 'h-aau-5g', vendor: 'Huawei', model: 'AAU5613 (5G)', gainDbi: 25.5, horizontalBeamwidth: 12, verticalBeamwidth: 6, frequencyRange: [3400, 3600], weightKg: 40, ports: 64 },

  // --- ERICSSON (AIR & Passive Series) ---
  { id: 'e-4870-p', vendor: 'Ericsson', model: '4870 Series Passive', gainDbi: 17.5, horizontalBeamwidth: 65, verticalBeamwidth: 7.5, frequencyRange: [698, 2690], weightKg: 26, ports: 10 },
  { id: 'e-air-6449', vendor: 'Ericsson', model: 'AIR 6449 (B41)', gainDbi: 24.5, horizontalBeamwidth: 12, verticalBeamwidth: 6, frequencyRange: [2496, 2690], weightKg: 38, ports: 64 },
  { id: 'e-air-3239', vendor: 'Ericsson', model: 'AIR 3239 (B78)', gainDbi: 23.0, horizontalBeamwidth: 15, verticalBeamwidth: 8, frequencyRange: [3400, 3800], weightKg: 25, ports: 32 },
  { id: 'e-air-5121', vendor: 'Ericsson', model: 'AIR 5121 (mmWave)', gainDbi: 34.0, horizontalBeamwidth: 4, verticalBeamwidth: 4, frequencyRange: [27000, 29500], weightKg: 18, ports: 1024 },
  { id: 'e-p-1', vendor: 'Ericsson', model: 'Passive Tri-Band', gainDbi: 18.1, horizontalBeamwidth: 65, verticalBeamwidth: 7.0, frequencyRange: [1710, 2690], weightKg: 23, ports: 6 },

  // --- COMBA TELECOM ---
  { id: 'cb-hexa', vendor: 'Comba Telecom', model: 'Hexa-band Panel', gainDbi: 17.2, horizontalBeamwidth: 65, verticalBeamwidth: 7.5, frequencyRange: [698, 2690], weightKg: 34, ports: 12 },
  { id: 'cb-multi-4x4', vendor: 'Comba Telecom', model: 'Multi-Polarized 4×4', gainDbi: 18.0, horizontalBeamwidth: 65, verticalBeamwidth: 6.8, frequencyRange: [1710, 2690], weightKg: 19, ports: 8 },
  { id: 'cb-odd', vendor: 'Comba Telecom', model: 'ODV-065R17K-G', gainDbi: 17.0, horizontalBeamwidth: 65, verticalBeamwidth: 7.0, frequencyRange: [1710, 2170], weightKg: 16.5, ports: 4 },

  // --- AMPHENOL ---
  { id: 'amp-mb-2p', vendor: 'Amphenol', model: 'Multi-band 2-port', gainDbi: 16.8, horizontalBeamwidth: 65, verticalBeamwidth: 9.5, frequencyRange: [790, 960], weightKg: 14, ports: 2 },
  { id: 'amp-hp-mimo', vendor: 'Amphenol', model: 'High-port (22) MIMO', gainDbi: 18.4, horizontalBeamwidth: 65, verticalBeamwidth: 6.5, frequencyRange: [698, 2690], weightKg: 52, ports: 22 },
  { id: 'amp-6888', vendor: 'Amphenol', model: '6888600 (Hex)', gainDbi: 17.2, horizontalBeamwidth: 65, verticalBeamwidth: 7.0, frequencyRange: [698, 2170], weightKg: 20.2, ports: 6 },

  // --- PROSE TECHNOLOGIES ---
  { id: 'prose-2l8h', vendor: 'PROSE Technologies', model: '2L8H Series', gainDbi: 17.9, horizontalBeamwidth: 65, verticalBeamwidth: 7.0, frequencyRange: [698, 2690], weightKg: 38, ports: 10 },
  { id: 'prose-3l12h', vendor: 'PROSE Technologies', model: '3L12H Series', gainDbi: 18.5, horizontalBeamwidth: 65, verticalBeamwidth: 6.5, frequencyRange: [698, 2690], weightKg: 46, ports: 15 },

  // --- CICT MOBILE ---
  { id: 'cict-mp', vendor: 'CICT Mobile', model: 'Multi-port Panel', gainDbi: 18.1, horizontalBeamwidth: 65, verticalBeamwidth: 7.2, frequencyRange: [1710, 2690], weightKg: 24, ports: 12 },

  // --- TONGYU COMMUNICATION ---
  { id: 'tongyu-wb', vendor: 'Tongyu Communication', model: 'Wideband Base Station', gainDbi: 17.5, horizontalBeamwidth: 65, verticalBeamwidth: 7.5, frequencyRange: [698, 2690], weightKg: 21, ports: 6 },
  { id: 'tongyu-tqx', vendor: 'Tongyu Communication', model: 'TQX-182018-00', gainDbi: 18.0, horizontalBeamwidth: 65, verticalBeamwidth: 6.5, frequencyRange: [1710, 2170], weightKg: 19, ports: 6 },

  // --- NOKIA (IPAA+ & Passive) ---
  { id: 'n-ipaa', vendor: 'Nokia', model: 'IPAA+ Interleaved', gainDbi: 24.8, horizontalBeamwidth: 14, verticalBeamwidth: 6, frequencyRange: [3400, 3800], weightKg: 55, ports: 64 },
  { id: 'n-pass', vendor: 'Nokia', model: 'Passive Panel', gainDbi: 18.0, horizontalBeamwidth: 65, verticalBeamwidth: 7.0, frequencyRange: [698, 2690], weightKg: 23, ports: 8 },
  { id: 'n-aeqa', vendor: 'Nokia', model: 'AEQA Massive MIMO', gainDbi: 25.0, horizontalBeamwidth: 15, verticalBeamwidth: 5, frequencyRange: [3400, 3800], weightKg: 45, ports: 64 },

  // --- COMMSCOPE / ANDREW ---
  { id: 'cs-sector', vendor: 'CommScope', model: 'Sector Panel (5G)', gainDbi: 24.0, horizontalBeamwidth: 15, verticalBeamwidth: 6, frequencyRange: [3300, 3800], weightKg: 29, ports: 32 },
  { id: 'cs-sbnhh', vendor: 'CommScope', model: 'SBNHH-1D65B', gainDbi: 18.2, horizontalBeamwidth: 65, verticalBeamwidth: 7.2, frequencyRange: [698, 2360], weightKg: 18.4, ports: 6 },
  { id: 'andrew-multibeam', vendor: 'Andrew (CommScope)', model: 'Multibeam Antenna', gainDbi: 21.5, horizontalBeamwidth: 33, verticalBeamwidth: 7.0, frequencyRange: [1710, 2170], weightKg: 25, ports: 4 },
  { id: 'andrew-sector', vendor: 'Andrew (CommScope)', model: 'High Capacity Sector', gainDbi: 19.0, horizontalBeamwidth: 45, verticalBeamwidth: 7.5, frequencyRange: [1710, 2690], weightKg: 18, ports: 4 },

  // --- RFS ---
  { id: 'rfs-macro', vendor: 'RFS', model: 'Macro Panel Models', gainDbi: 17.6, horizontalBeamwidth: 65, verticalBeamwidth: 8.0, frequencyRange: [698, 2170], weightKg: 20, ports: 4 },
  { id: 'rfs-apx', vendor: 'RFS', model: 'APXVAARR24_43', gainDbi: 16.1, horizontalBeamwidth: 65, verticalBeamwidth: 12.1, frequencyRange: [617, 2360], weightKg: 58.0, ports: 14 },

  // --- KATHREIN ---
  { id: 'k-legacy', vendor: 'Kathrein', model: 'Legacy Panel Models', gainDbi: 16.0, horizontalBeamwidth: 65, verticalBeamwidth: 12.0, frequencyRange: [880, 960], weightKg: 15, ports: 2 },
  { id: 'k-80010', vendor: 'Kathrein', model: '80010865 (V-Pol)', gainDbi: 16.5, horizontalBeamwidth: 65, verticalBeamwidth: 11, frequencyRange: [790, 960], weightKg: 19.5, ports: 2 },

  // --- ZTE ---
  { id: 'zte-sector', vendor: 'ZTE', model: 'Base Station Sector', gainDbi: 18.0, horizontalBeamwidth: 65, verticalBeamwidth: 7.0, frequencyRange: [1710, 2690], weightKg: 21, ports: 8 },
  { id: 'zte-mimo', vendor: 'ZTE', model: 'Massive MIMO 5G', gainDbi: 25.2, horizontalBeamwidth: 12, verticalBeamwidth: 5, frequencyRange: [3400, 3600], weightKg: 42, ports: 64 },

  // --- JMA WIRELESS ---
  { id: 'jma-x7', vendor: 'JMA Wireless', model: 'X7CAP-665-2', gainDbi: 18.0, horizontalBeamwidth: 65, verticalBeamwidth: 9.7, frequencyRange: [698, 2690], weightKg: 21.0, ports: 8 },
  { id: 'jma-small', vendor: 'JMA Wireless', model: 'Small Cell Cantenna', gainDbi: 10.0, horizontalBeamwidth: 360, verticalBeamwidth: 12, frequencyRange: [1710, 2170], weightKg: 10, ports: 4 },

  // --- ROSENBERGER ---
  { id: 'rosen-bt', vendor: 'Rosenberger', model: 'BT-32-65-02-D', gainDbi: 18.4, horizontalBeamwidth: 64, verticalBeamwidth: 7.5, frequencyRange: [1710, 2690], weightKg: 22.5, ports: 12 },
  { id: 'rosen-cband', vendor: 'Rosenberger', model: '4T4R C-Band', gainDbi: 21.0, horizontalBeamwidth: 60, verticalBeamwidth: 6.5, frequencyRange: [3300, 4200], weightKg: 15, ports: 4 },

  // --- CELLMAX ---
  { id: 'cx-high', vendor: 'CellMax', model: 'High Efficiency 120410', gainDbi: 21.0, horizontalBeamwidth: 65, verticalBeamwidth: 4.8, frequencyRange: [1710, 2170], weightKg: 28.0, ports: 4 },
  { id: 'cx-macro', vendor: 'CellMax', model: '14-Port Macro', gainDbi: 19.5, horizontalBeamwidth: 65, verticalBeamwidth: 6.5, frequencyRange: [698, 2690], weightKg: 62, ports: 14 },

  // --- ADDITIONAL FILL TO REACH 50+ ---
  { id: 'h-a19', vendor: 'Huawei', model: 'A194518R0', gainDbi: 18.0, horizontalBeamwidth: 65, verticalBeamwidth: 7.2, frequencyRange: [1710, 2170], weightKg: 19, ports: 2 },
  { id: 'e-air-2488', vendor: 'Ericsson', model: 'AIR 2488', gainDbi: 16.5, horizontalBeamwidth: 65, verticalBeamwidth: 9, frequencyRange: [1800, 2100], weightKg: 22, ports: 8 },
  { id: 'n-awhf', vendor: 'Nokia', model: 'AWHF (B28)', gainDbi: 15.5, horizontalBeamwidth: 65, verticalBeamwidth: 12, frequencyRange: [700, 800], weightKg: 20, ports: 4 },
  { id: 'c-rvv', vendor: 'CommScope', model: 'RVV-65B-R3', gainDbi: 17.0, horizontalBeamwidth: 65, verticalBeamwidth: 9.5, frequencyRange: [694, 2690], weightKg: 26.3, ports: 6 },
  { id: 'k-80010735', vendor: 'Kathrein', model: '80010735', gainDbi: 17.2, horizontalBeamwidth: 65, verticalBeamwidth: 9.5, frequencyRange: [698, 960], weightKg: 18, ports: 2 },
  { id: 'prose-1', vendor: 'PROSE Technologies', model: 'Small Cell Omni', gainDbi: 8.0, horizontalBeamwidth: 360, verticalBeamwidth: 20, frequencyRange: [1710, 2690], weightKg: 4, ports: 2 },
  { id: 'cict-2', vendor: 'CICT Mobile', model: 'TDD 8T8R', gainDbi: 17.0, horizontalBeamwidth: 65, verticalBeamwidth: 7.5, frequencyRange: [2300, 2600], weightKg: 18, ports: 8 },
  { id: 'tongyu-3', vendor: 'Tongyu Communication', model: 'High Gain 2.6G', gainDbi: 20.0, horizontalBeamwidth: 33, verticalBeamwidth: 6.0, frequencyRange: [2500, 2690], weightKg: 17, ports: 4 },
  { id: 'zte-4', vendor: 'ZTE', model: 'L-Band Sector', gainDbi: 17.5, horizontalBeamwidth: 65, verticalBeamwidth: 8.0, frequencyRange: [1400, 1500], weightKg: 19, ports: 4 },
  { id: 'rfs-5', vendor: 'RFS', model: 'APXVLL13-C', gainDbi: 15.0, horizontalBeamwidth: 65, verticalBeamwidth: 15, frequencyRange: [698, 894], weightKg: 12, ports: 2 },
  { id: 'andrew-5', vendor: 'Andrew (CommScope)', model: 'Stadium High Gain', gainDbi: 23.0, horizontalBeamwidth: 30, verticalBeamwidth: 30, frequencyRange: [1710, 2690], weightKg: 14, ports: 2 }
];

export const TOWER_TYPES = Object.values(TowerType);

export const DEFAULT_SITE: any = {
  name: 'Macro Hub',
  lat: 40.7128,
  lng: -74.0060,
  towerHeightM: 35,
  towerType: TowerType.LATTICE,
  sectors: [],
  status: 'planned'
};
