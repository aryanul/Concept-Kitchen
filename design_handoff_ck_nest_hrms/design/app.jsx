// Main App — router + tweaks integration

const { useState: _useState, useEffect: _useEffect } = React;
const {
  ToastProvider, GlobalStyles, Sidebar, TopBar,
  DashboardView, EmployeeView, ShiftsView, HolidaysView, AttendanceView,
  SalaryView, PayrollView, LoansView, IncrementsView, LeavesView,
  ToursView, IncentivesView, StubView,
} = window;

const App = () => {
  const [view, setView] = _useState('dashboard');
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "#E91E63",
    "density": "comfortable",
    "showWeather": true,
    "sidebarStyle": "default"
  }/*EDITMODE-END*/);

  // Apply accent globally
  _useEffect(() => {
    document.documentElement.style.setProperty('--ck-accent', t.accent);
  }, [t.accent]);

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <DashboardView goTo={setView}/>;
      case 'employee-master': return <EmployeeView/>;
      case 'shifts': return <ShiftsView/>;
      case 'holidays': return <HolidaysView/>;
      case 'attendance': return <AttendanceView/>;
      case 'salary-master': return <SalaryView/>;
      case 'payroll': return <PayrollView/>;
      case 'loans': return <LoansView/>;
      case 'increments': return <IncrementsView/>;
      case 'leaves': return <LeavesView/>;
      case 'tours': return <ToursView/>;
      case 'incentives': return <IncentivesView/>;
      case 'job-profile': return <StubView title="Job Profiles" subtitle="Define job descriptions, KRAs and compensation bands" icon="briefcase" message="Job profile templates streamline vacancy creation and onboarding. Phase 1 focuses on Employment, with Hiring slated for Phase 2."/>;
      case 'vacancy': return <StubView title="Vacancies & Job Listings" subtitle="Open positions, applicant tracking and interview pipelines" icon="grid" message="Track open requisitions, source candidates and run structured interviews. Comes online in Phase 2."/>;
      case 'onboarding': return <StubView title="Induction & Onboarding" subtitle="Pre-joining checklist, document collection and Day-1 induction" icon="users" message="A 14-day onboarding journey with auto-reminders and document workflows. Phase 2."/>;
      case 'exit-clearance': return <StubView title="Exit Clearance" subtitle="No-due workflow across IT, Finance, HR and Admin" icon="logout" message="Multi-department clearance with auto-generated experience letters. Phase 3."/>;
      case 'fnf': return <StubView title="Full & Final Settlement" subtitle="Final payroll, leave encashment and recoveries" icon="card" message="Calculate final dues including recoveries, gratuity and leave encashment. Phase 3."/>;
      case 'settings': return <StubView title="Settings" subtitle="Organisation, modules, integrations and security" icon="settings" message="Configure modules, biometric integrations, bank APIs and notification gateways."/>;
      default: return <DashboardView goTo={setView}/>;
    }
  };

  const density = t.density === 'compact' ? 0.92 : t.density === 'spacious' ? 1.06 : 1;

  return (
    <ToastProvider>
      <GlobalStyles/>
      <style>{`
        :root { --ck-accent: ${t.accent}; }
        body { background: #F9FAFB; }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, Roboto, sans-serif' }}>
        <Sidebar current={view} setCurrent={setView}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TopBar/>
          <main key={view} style={{
            padding: `${28 * density}px 32px 60px`,
            animation: 'slideIn 220ms ease-out',
          }}>
            {renderView()}
          </main>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Brand">
          <TweakColor label="Accent color" value={t.accent} onChange={v => setTweak('accent', v)}
            options={['#E91E63', '#2563EB', '#059669', '#D97757', '#7C3AED']}/>
        </TweakSection>
        <TweakSection title="Layout">
          <TweakRadio label="Density" value={t.density} onChange={v => setTweak('density', v)}
            options={['compact','comfortable','spacious']}/>
        </TweakSection>
        <TweakSection title="Top bar">
          <TweakToggle label="Show weather chip" value={t.showWeather} onChange={v => setTweak('showWeather', v)}/>
        </TweakSection>
        <TweakSection title="Quick navigation">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['dashboard','Dashboard'],['employee-master','Employees'],
              ['shifts','Shifts'],['attendance','Attendance'],
              ['payroll','Payroll'],['leaves','Leaves'],
              ['loans','Loans'],['increments','Increments'],
              ['tours','Tours'],['incentives','Incentives'],
              ['holidays','Holidays'],['salary-master','Salary'],
            ].map(([id, lbl]) => (
              <button key={id} onClick={() => setView(id)} style={{
                padding: '8px 10px', fontSize: 11.5, fontWeight: 500,
                background: view === id ? '#272727' : '#F4F4F5',
                color: view === id ? '#fff' : '#4D4D4D',
                border: 'none', borderRadius: 7, cursor: 'pointer',
                fontFamily: 'Inter, Roboto, sans-serif', textAlign: 'left',
              }}>{lbl}</button>
            ))}
          </div>
        </TweakSection>
      </TweaksPanel>
    </ToastProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
