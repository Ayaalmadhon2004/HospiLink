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
  createdAt: string;
  reportedBy?: string;
}
