// src/types/dispatch.types.ts
export enum UnitStatus {
  AVAILABLE = 'AVAILABLE',
  EN_ROUTE = 'EN_ROUTE',
  ON_SCENE = 'ON_SCENE',
  TRANSPORTING = 'TRANSPORTING',
  AT_HOSPITAL = 'AT_HOSPITAL',
  OFF_DUTY = 'OFF_DUTY',
}

export enum UnitType {
  AMBULANCE = 'AMBULANCE',
  PARAMEDIC = 'PARAMEDIC',
  HELICOPTER = 'HELICOPTER',
  FIRE_TRUCK = 'FIRE_TRUCK',
  POLICE = 'POLICE',
}

export interface DispatchUnit {
  id: string;
  unitCode: string;        // AMB-04, AMB-09
  unitType: UnitType;
  status: UnitStatus;
  currentCall?: string;
  destination?: string;
  crew: string[];
  eta?: number;            // minutes
  location?: {
    lat: number;
    lng: number;
  };
  department: string;
  lastUpdated: Date;
}

export interface DispatchCall {
  id: string;
  type: string;            // Cardiac arrest, MVC
  location: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedUnitId?: string;
  status: 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE' | 'COMPLETED';
  createdAt: Date;
}