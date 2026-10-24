import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import i18n from '../../i18n';
import { PatientsPage } from '../PatientsPage';
import Beds from '../Beds';
import SettingsPage from '../SettingsPage';
import DispatchDashboard from '../DispatchDashboard';
import { StaffDirectoryPage } from '../StaffDirectoryPage';
import { IncidentsPage } from '../IncidentsPage';
import { apiGet } from '../../services/api';

// vi.mock factories are hoisted, so shared fixtures must be hoisted too
const { PATIENT_AGE, TOTAL_PATIENTS, TOTAL_PAGES, INCIDENT_TEAMS, INCIDENT_PROGRESS, UNIT_ETA } = vi.hoisted(() => ({
  PATIENT_AGE: 40,
  TOTAL_PATIENTS: 25,
  TOTAL_PAGES: 3,
  INCIDENT_TEAMS: 2,
  INCIDENT_PROGRESS: 40,
  UNIT_ETA: 7,
}));

vi.mock('../../hooks/usePatients', () => ({
  usePatients: () => ({
    patients: [
      {
        id: 'p1',
        patientCode: 'PT-1',
        name: 'Ahmad Khaled',
        age: PATIENT_AGE,
        gender: 'MALE',
        department: 'Cardiology',
        status: 'CRITICAL',
        admissionDate: '2026-01-15T10:00:00.000Z',
      },
    ],
    pagination: { totalCount: TOTAL_PATIENTS, totalPages: TOTAL_PAGES },
    loading: false,
    isFetching: false,
    error: '',
  }),
}));

vi.mock('../../services/api', () => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('../../hooks/useSettings', () => ({
  default: () => ({
    loading: false,
    settings: {
      profile: { id: '1', name: 'Dr. Aya', email: 'a@b.c', role: 'DOCTOR', department: 'General', shift: 'DAY', status: 'ACTIVE' },
      notifications: {
        criticalVitalsAlerts: true,
        incidentEscalations: false,
        shiftReminders: false,
        dispatchAlerts: false,
        appointmentReminders: false,
      },
      security: { twoFactorAuth: false, autoLockIdleSessions: false, compactDensity: false },
      display: { theme: 'light', language: 'en', timezone: 'UTC' },
    },
    updateProfile: vi.fn(),
    updateNotifications: vi.fn(),
    updateSecurity: vi.fn(),
    updateDisplay: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDispatchSocket', () => ({
  useDispatchSocket: () => ({ isConnected: true, latestUnitUpdate: null, criticalAlert: null }),
}));

vi.mock('../../hooks/useStaffSocket', () => ({ useStaffSocket: () => null }));
vi.mock('../../hooks/useIncidentsSocket', () => ({ useIncidentsSocket: () => null }));

vi.mock('../../services/staffService', () => ({
  getStaff: vi.fn().mockResolvedValue({
    data: [
      { id: 's1', name: 'Sara Ali', email: 's@h.com', role: 'Nurse', department: 'Cardiology', isActive: true, shifts: [{ id: 'sh1', type: 'NIGHT', staffId: 's1', startTime: '', endTime: '', department: 'Cardiology' }] },
    ],
  }),
  getShiftTimeline: vi.fn().mockResolvedValue({
    data: {
      Cardiology: [{ id: 'sh1', staffId: 's1', staffName: 'Sara Ali', type: 'NIGHT', startTime: '2026-10-21T08:00:00', endTime: '2026-10-21T16:00:00', department: 'Cardiology' }],
    },
  }),
  deleteStaff: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
}));

vi.mock('../../services/incidentsService', () => ({
  getIncidents: vi.fn().mockResolvedValue({
    data: [
      { id: 'i1', code: 'INC-1', title: 'Fire drill', type: 'OTHER', severity: 'CRITICAL', status: 'ACTIVE', location: 'ER', teams: INCIDENT_TEAMS, progress: INCIDENT_PROGRESS, createdAt: new Date().toISOString() },
    ],
  }),
  deleteIncident: vi.fn(),
  updateIncidentStatus: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

const renderPage = (ui: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

describe('pages in Arabic', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('ar');
  });

  it('sets the document to RTL', () => {
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('renders the patients list with Arabic headings, status and pagination', () => {
    renderPage(<PatientsPage />);
    expect(screen.getByRole('heading', { name: 'المرضى' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'تاريخ الدخول' })).toBeInTheDocument();
    expect(screen.getByLabelText('الحالة: حرجة')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ابحث بالاسم أو الرقم...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الانتقال إلى الصفحة التالية' })).toBeInTheDocument();
    // API data values stay as returned by the server
    expect(screen.getByText('Ahmad Khaled')).toBeInTheDocument();
  });

  it('renders the admit patient modal in Arabic', async () => {
    mockedApiGet.mockResolvedValue({ success: true, data: [] });
    renderPage(<PatientsPage />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'تسجيل دخول مريض جديد' }));
    expect(await screen.findByRole('heading', { name: 'تسجيل دخول مريض جديد' })).toBeInTheDocument();
    expect(screen.getByLabelText('الاسم الكامل', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'اختر القسم' })).toBeInTheDocument();
  });

  it('renders beds with translated status labels', async () => {
    mockedApiGet.mockImplementation(async (url: string) => {
      if (url === '/beds') {
        return {
          success: true,
          data: [{ id: 'abcdef123456', bedNumber: 'ICU-1', status: 'OCCUPIED', wardId: 'w1', ward: { id: 'w1', name: 'ICU Ward' }, patient: null }],
        };
      }
      return { success: true, data: [] };
    });
    renderPage(<Beds />);
    expect(await screen.findByRole('heading', { name: 'الأسرّة والأقسام' })).toBeInTheDocument();
    expect(screen.getAllByText('مشغول').length).toBeGreaterThan(0);
    expect(screen.getByText('السرير ICU-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة سرير' })).toBeInTheDocument();
  });

  it('renders the settings page in Arabic', () => {
    renderPage(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'الإعدادات' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'تفعيل تنبيهات العلامات الحيوية الحرجة' })).toBeInTheDocument();
    expect(screen.getByText('الأمان والعرض')).toBeInTheDocument();
  });

  it('renders the dispatch dashboard in Arabic', async () => {
    mockedApiGet.mockResolvedValue({
      success: true,
      data: [{ id: 'u1', unitCode: 'AMB-1', unitType: 'AMBULANCE', status: 'EN_ROUTE', crew: ['A', 'B'], eta: UNIT_ETA }],
    });
    renderPage(<DispatchDashboard />);
    expect(screen.getByRole('heading', { name: 'الإسعاف' })).toBeInTheDocument();
    expect(await screen.findByText('سيارة إسعاف')).toBeInTheDocument();
    expect(screen.getByText(`${UNIT_ETA} دقائق`)).toBeInTheDocument();
    expect(screen.getAllByText('بث مباشر').length).toBeGreaterThan(0);
  });

  it('renders the staff directory with translated roles and shifts', async () => {
    renderPage(<StaffDirectoryPage />);
    expect(await screen.findByRole('heading', { name: 'الطاقم والمناوبات' })).toBeInTheDocument();
    expect(screen.getAllByText('ممرض/ممرضة').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ليلية').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sara Ali').length).toBeGreaterThan(0);
    // StaffCard (mobile list) and ShiftTimeline are mounted on the page
    expect(screen.getByRole('region', { name: 'بطاقات الطاقم' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /Sara Ali/ })).toBeInTheDocument();
    expect(await screen.findByText('الجدول الزمني للورديات')).toBeInTheDocument();
    expect(await screen.findByTitle(/Sara Ali - /)).toBeInTheDocument();
  });

  it('renders incidents with translated severity and relative time', async () => {
    renderPage(<IncidentsPage />);
    expect(await screen.findByRole('heading', { name: 'الحوادث' })).toBeInTheDocument();
    expect(screen.getAllByText('حرجة').length).toBeGreaterThan(0);
    expect(screen.getAllByText('منذ 0 دقيقة').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText('Fire drill')).toBeInTheDocument());
  });
});
