import type { Page, Route } from '@playwright/test';

export const doctor = {
  id: '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10',
  name: 'Dr. Sara Haddad',
  email: 'sara@hospital.com',
  role: 'DOCTOR',
  department: 'Cardiology',
};

export const patients = [
  {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    patientCode: 'PT-2041',
    name: 'Ahmad Khaled',
    age: 34,
    gender: 'MALE',
    status: 'CRITICAL',
    department: 'Cardiology',
    diagnosis: 'Chest pain',
    admissionDate: '2026-10-01T08:00:00.000Z',
    bed: { bedNumber: 'B-12', ward: { name: 'ICU' } },
    doctor: { id: doctor.id, name: doctor.name },
  },
  {
    id: '1c7d6d0e-0d8a-4c0e-8f55-6f3f0f0a9a11',
    patientCode: 'PT-2042',
    name: 'Lina Mansour',
    age: 52,
    gender: 'FEMALE',
    status: 'STABLE',
    department: 'Neurology',
    diagnosis: 'Migraine',
    admissionDate: '2026-10-02T09:30:00.000Z',
    bed: null,
    doctor: null,
  },
];

interface MockOptions {
  /** Whether the session cookie is already valid. */
  loggedIn?: boolean;
  /** Credentials accepted by POST /auth/login. */
  validLogin?: { email: string; password: string };
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Stateful in-browser fake of the backend. Anything not listed answers with an
 * empty success so unrelated widgets (sidebar badges, charts) just render empty.
 */
export const mockApi = async (page: Page, options: MockOptions = {}) => {
  let loggedIn = options.loggedIn ?? false;
  const validLogin = options.validLogin ?? { email: doctor.email, password: 'correct-horse' };

  // Real-time sockets are out of scope here.
  await page.route('**/socket.io/**', (route) => route.abort());

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const path = pathname.replace(/^\/api/, '');
    const method = request.method();

    if (path === '/auth/me') {
      return loggedIn
        ? json(route, 200, { success: true, user: doctor })
        : json(route, 401, { success: false, message: 'Not authenticated' });
    }

    if (path === '/auth/login' && method === 'POST') {
      const body = request.postDataJSON() as { email: string; password: string };
      if (body.email === validLogin.email && body.password === validLogin.password) {
        loggedIn = true;
        return json(route, 200, { success: true, user: doctor });
      }
      return json(route, 401, { success: false, message: 'Invalid credentials' });
    }

    if (path === '/auth/logout' && method === 'POST') {
      loggedIn = false;
      return json(route, 200, { success: true });
    }

    if (path === '/patients' && method === 'GET') {
      const search = new URL(request.url()).searchParams.get('search')?.toLowerCase();
      const rows = search
        ? patients.filter((p) => p.name.toLowerCase().includes(search) || p.patientCode.toLowerCase().includes(search))
        : patients;
      return json(route, 200, {
        success: true,
        data: rows,
        pagination: { page: 1, limit: 10, totalCount: rows.length, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });
    }

    const detail = path.match(/^\/patients\/([^/]+)$/);
    if (detail && method === 'GET') {
      const found = patients.find((p) => p.id === detail[1]);
      return found
        ? json(route, 200, {
            success: true,
            data: { ...found, bed: found.bed ? { bedNumber: found.bed.bedNumber, wardName: found.bed.ward.name } : null },
          })
        : json(route, 404, { success: false, message: 'Patient not found' });
    }

    if (path === '/notifications') {
      return json(route, 200, {
        success: true,
        data: [
          { id: 'n1', type: 'INFO', title: 'Bed 4 freed', message: 'Ward A', read: false, link: null, createdAt: '2026-10-21T08:00:00.000Z' },
        ],
        unreadCount: 1,
      });
    }

    if (path === '/staff/shifts/timeline') {
      return json(route, 200, {
        success: true,
        data: {
          Cardiology: [
            { id: 'sh1', staffName: 'Sara Ali', type: 'DAY', startTime: '2026-10-21T08:00:00', endTime: '2026-10-21T16:00:00', department: 'Cardiology', staffId: 's1' },
          ],
        },
      });
    }

    if (path === '/staff' && method === 'GET') {
      return json(route, 200, {
        success: true,
        data: [
          { id: 's1', name: 'Sara Ali', email: 'sara@hospilink.test', role: 'NURSE', department: 'Cardiology', isActive: true, shifts: [] },
        ],
      });
    }

    if (path === '/patients/flow') return json(route, 200, { success: true, data: [{ date: '2026-10-21', admissions: 1, discharges: 0 }] });
    if (path === '/patients/recent') return json(route, 200, { success: true, data: [] });

    return json(route, 200, { success: true, data: [] });
  });
};
