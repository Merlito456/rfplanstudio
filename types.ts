
export enum TowerType {
  MONOPOLE = 'Monopole',
  LATTICE = 'Lattice',
  GUYED = 'Guyed',
  ROOFTOP = 'Rooftop'
}

export interface AntennaModel {
  id: string;
  vendor: string;
  model: string;
  gainDbi: number;
  horizontalBeamwidth: number;
  verticalBeamwidth: number;
  frequencyRange: [number, number]; // MHz
  weightKg: number;
  ports: number;
}

export interface Sector {
  id: string;
  antennaId: string;
  azimuth: number; // degrees
  mechanicalTilt: number; // degrees
  electricalTilt: number; // degrees
  txPowerDbm: number;
  frequencyMhz: number;
  heightM: number;
}

export interface ProjectComment {
  id: string;
  lat: number;
  lng: number;
  text: string;
  author: string;
  timestamp: number;
  category: 'issue' | 'task' | 'general' | 'client';
}

export interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  towerHeightM: number;
  towerType: TowerType;
  sectors: Sector[];
  status: 'planned' | 'active' | 'retired';
}

export interface RFProject {
  name: string;
  sites: Site[];
  comments: ProjectComment[];
  lastSaved: number;
  version: string;
}

export interface CoveragePoint {
  lat: number;
  lng: number;
  rsrp: number; // dBm
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface PhoneDeviceState {
  lat: number;
  lng: number;
  rsrp: number;
  sinr: number;
  servingCellId: string | null;
  servingSiteName: string | null;
  neighbors: Array<{ siteName: string; rsrp: number }>;
  handoverCount: number;
  lastHandoverTime: number | null;
}
