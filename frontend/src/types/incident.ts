export interface Incident {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: string;
  severity: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
  status: 'ACTIVE' | 'RESOLVED' | 'PENDING';
  location: string;
  teams: number;
  progress: number;
  triageLevel?: string;
  reportedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type CreateIncidentData = Partial<Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>>;
