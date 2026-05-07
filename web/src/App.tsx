import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './routes/login/LoginPage';
import { DashboardPage } from './routes/dashboard/DashboardPage';
import { EmployeesPage } from './routes/employees/EmployeesPage';
import { HolidaysPage } from './routes/holidays/HolidaysPage';
import { ShiftsPage } from './routes/shifts/ShiftsPage';
import { SalaryMasterPage } from './routes/salary-master/SalaryMasterPage';
import { AttendancePage } from './routes/attendance/AttendancePage';
import { LeavesPage } from './routes/leaves/LeavesPage';
import { PayrollPage } from './routes/payroll/PayrollPage';
import { LoansPage } from './routes/loans/LoansPage';
import { IncrementsPage } from './routes/increments/IncrementsPage';
import { ToursPage } from './routes/tours/ToursPage';
import { IncentivesPage } from './routes/incentives/IncentivesPage';
import { JobProfilePage } from './routes/hiring/JobProfilePage';
import { VacanciesPage } from './routes/hiring/VacanciesPage';
import { OnboardingPage } from './routes/hiring/OnboardingPage';
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
            <Route path="/employees"     element={<EmployeesPage />} />
            <Route path="/shifts"        element={<ShiftsPage />} />
            <Route path="/holidays"      element={<HolidaysPage />} />
            <Route path="/attendance"    element={<AttendancePage />} />
            <Route path="/salary-master" element={<SalaryMasterPage />} />
            <Route path="/payroll"       element={<PayrollPage />} />
            <Route path="/loans"         element={<LoansPage />} />
            <Route path="/increments"    element={<IncrementsPage />} />
            <Route path="/leaves"        element={<LeavesPage />} />
            <Route path="/tours"         element={<ToursPage />} />
            <Route path="/incentives"    element={<IncentivesPage />} />

            {/* Phase 2 stubs */}
            <Route path="/job-profile"   element={<JobProfilePage />} />
            <Route path="/vacancy"       element={<VacanciesPage />} />
            <Route path="/onboarding"    element={<OnboardingPage />} />

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
