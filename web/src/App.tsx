import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './routes/login/LoginPage';
import { DashboardPage } from './routes/dashboard/DashboardPage';
import { EmployeesPage } from './routes/employees/EmployeesPage';
import { EmployeeDetailPage } from './routes/employees/EmployeeDetailPage';
import { CompensationsListPage } from './routes/compensations/CompensationsListPage';
import { CompensationDetailPage } from './routes/compensations/CompensationDetailPage';
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
import { ListingDetailPage } from './routes/hiring/ListingDetailPage';
import { OnboardingPage } from './routes/hiring/OnboardingPage';
import { OnboardingDetailPage } from './routes/hiring/OnboardingDetailPage';
import { IdCardPage } from './routes/hiring/IdCardPage';
import {
  MastersHomePage,
  BranchMasterPage,
  DddMasterPage,
  LocationMasterPage,
  ShiftMasterPage,
  SalaryGradeMasterPage,
  SkillsMasterPage,
  TrainingModuleMasterPage,
  CompanyMasterPage,
  InterviewTemplateMasterPage,
  ScreeningTemplateMasterPage,
  OfferTemplateMasterPage,
  GiveawayTemplateMasterPage,
  UserConsolePage,
  HolidayMasterPage,
  AttendanceRuleMasterPage,
  LookupMasterPage,
  TagMasterPage,
  PhonePoolMasterPage,
  ErpModuleMasterPage,
  AssetCategoryMasterPage,
  AssetMasterPage,
  PresentationMasterPage,
  OnboardingDocMasterPage,
  OnboardingItemMasterPage,
} from './routes/masters/MasterPages';
import { InductionTemplateMasterPage, OnboardingTemplateMasterPage } from './routes/masters/TemplateMasterPages';
import { ActivityLogPage } from './routes/activity-log/ActivityLogPage';
import { StubPage } from './routes/StubPage';
import { WipePage } from './routes/dev/WipePage';
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
            <Route path="/activity-log" element={<ActivityLogPage />} />
            <Route path="/masters" element={<MastersHomePage />} />
            <Route path="/masters/branches" element={<BranchMasterPage />} />
            <Route path="/masters/ddd" element={<DddMasterPage />} />
            <Route path="/masters/locations" element={<LocationMasterPage />} />
            <Route path="/masters/shifts" element={<ShiftMasterPage />} />
            <Route path="/masters/salary-grades" element={<SalaryGradeMasterPage />} />
            <Route path="/masters/skills" element={<SkillsMasterPage />} />
            <Route path="/masters/training-modules" element={<TrainingModuleMasterPage />} />
            <Route path="/masters/induction-templates" element={<InductionTemplateMasterPage />} />
            <Route path="/masters/onboarding-templates" element={<OnboardingTemplateMasterPage />} />
            <Route path="/masters/companies" element={<CompanyMasterPage />} />
            <Route path="/masters/interview-templates" element={<InterviewTemplateMasterPage />} />
            <Route path="/masters/screening-templates" element={<ScreeningTemplateMasterPage />} />
            <Route path="/masters/offer-templates" element={<OfferTemplateMasterPage />} />
            <Route path="/masters/giveaways" element={<GiveawayTemplateMasterPage />} />
            <Route path="/masters/users" element={<UserConsolePage />} />
            <Route path="/masters/holidays" element={<HolidayMasterPage />} />
            <Route path="/masters/attendance-rules" element={<AttendanceRuleMasterPage />} />
            <Route path="/masters/lookups" element={<LookupMasterPage />} />
            <Route path="/masters/tags" element={<TagMasterPage />} />
            <Route path="/masters/phone-pool" element={<PhonePoolMasterPage />} />
            <Route path="/masters/erp-modules" element={<ErpModuleMasterPage />} />
            <Route path="/masters/asset-categories" element={<AssetCategoryMasterPage />} />
            <Route path="/masters/assets" element={<AssetMasterPage />} />
            <Route path="/masters/presentations" element={<PresentationMasterPage />} />
            <Route path="/masters/onboarding-docs" element={<OnboardingDocMasterPage />} />
            <Route path="/masters/onboarding-items" element={<OnboardingItemMasterPage />} />

            {/* Phase 1 — placeholders until each module is built */}
            <Route path="/employees"     element={<EmployeesPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/compensations"      element={<CompensationsListPage />} />
            <Route path="/compensations/new"  element={<CompensationDetailPage />} />
            <Route path="/compensations/:id"  element={<CompensationDetailPage />} />
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
            <Route path="/hiring/listings/:id" element={<ListingDetailPage />} />
            <Route path="/onboarding"    element={<OnboardingPage />} />
            <Route path="/onboarding/:applicantId" element={<OnboardingDetailPage />} />
            <Route path="/onboarding/:applicantId/id-card" element={<IdCardPage />} />

            {/* Phase 3 stubs */}
            <Route path="/exit-clearance" element={<StubPage title="Exit Clearance"          phase="Phase 3" />} />
            <Route path="/fnf"            element={<StubPage title="Full & Final Settlement" phase="Phase 3" />} />

            <Route path="/settings"      element={<StubPage title="Settings" phase="a later step" />} />

            {/* Dev-only DB wipe utility (HR_ADMIN gated server-side) */}
            <Route path="/dev/wipe"      element={<WipePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
