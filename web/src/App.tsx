import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './routes/login/LoginPage';
import { DashboardPage } from './routes/dashboard/DashboardPage';
import { StubPage } from './routes/StubPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/shell/AppLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />

            {/* Phase 1 — placeholders until each module is built */}
            <Route path="/employees"     element={<StubPage title="Employee Master"             phase="Phase 1" />} />
            <Route path="/shifts"        element={<StubPage title="Duty Shifts & Rosters"       phase="Phase 1" />} />
            <Route path="/holidays"      element={<StubPage title="Holidays"                    phase="Phase 1" />} />
            <Route path="/attendance"    element={<StubPage title="Attendance & Exceptions"     phase="Phase 1" />} />
            <Route path="/salary-master" element={<StubPage title="Salary Structure & Compo."   phase="Phase 1" />} />
            <Route path="/payroll"       element={<StubPage title="Payroll Runs & Pay-slips"    phase="Phase 1" />} />
            <Route path="/loans"         element={<StubPage title="Advances & Loans"            phase="Phase 1" />} />
            <Route path="/increments"    element={<StubPage title="Increments & Appraisals"     phase="Phase 1" />} />
            <Route path="/leaves"        element={<StubPage title="Leaves & Approvals"          phase="Phase 1" />} />
            <Route path="/tours"         element={<StubPage title="Tour & Travel"               phase="Phase 1" />} />
            <Route path="/incentives"    element={<StubPage title="Incentives & Perks"          phase="Phase 1" />} />

            {/* Phase 2 stubs */}
            <Route path="/job-profile"   element={<StubPage title="Job Profile"  phase="Phase 2" />} />
            <Route path="/vacancy"       element={<StubPage title="Vacancies"    phase="Phase 2" />} />
            <Route path="/onboarding"    element={<StubPage title="Onboarding"   phase="Phase 2" />} />

            {/* Phase 3 stubs */}
            <Route path="/exit-clearance" element={<StubPage title="Exit Clearance"          phase="Phase 3" />} />
            <Route path="/fnf"            element={<StubPage title="Full & Final Settlement" phase="Phase 3" />} />

            <Route path="/settings"      element={<StubPage title="Settings" phase="a later step" />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
