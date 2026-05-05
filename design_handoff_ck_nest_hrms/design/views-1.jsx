// Views part 1: Dashboard, Employees, Shifts, Holidays, Attendance

const { BRANCHES, DEPARTMENTS, SHIFTS, EMPLOYEES, ATTENDANCE,
  HOLIDAYS, LEAVES, PAYROLL, LOANS, INCREMENTS, TOURS, INCENTIVES, SALARY_GRADES } = window.CKData;

// ============= DASHBOARD =============
const DashboardView = ({ goTo }) => {
  const stats = [
    { label: 'Total Employees', value: '264', delta: '+12 this month', icon: 'users', tint: 250 },
    { label: 'Present Today', value: '241', delta: '91% attendance', icon: 'attendance', tint: 145 },
    { label: 'Pending Approvals', value: '18', delta: '7 leave · 11 inc.', icon: 'leave', tint: 60 },
    { label: 'Payroll This Month', value: '₹1.25 Cr', delta: 'Run on 31 May', icon: 'payroll', tint: 340 },
  ];

  return (
    <div>
      <PageHeader
        title="Good evening, Darpan"
        subtitle="Here's what's happening across Concept Kitchen today, 5 May 2026."
        actions={<>
          <Button icon="download" variant="secondary">Export Report</Button>
          <Button icon="plus" variant="primary">Quick Action</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {stats.map((s, i) => (
          <Card key={i} padding={20}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `oklch(0.95 0.04 ${s.tint})`,
                color: `oklch(0.45 0.13 ${s.tint})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={s.icon} size={20} stroke={1.8}/>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6B7280', fontFamily: 'Inter, Roboto, sans-serif' }}>
                <Icon name="arrow-up-right" size={12}/>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Inter, Roboto, sans-serif' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#272727', letterSpacing: '-0.02em', fontFamily: 'Inter, Roboto, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, fontFamily: 'Inter, Roboto, sans-serif' }}>{s.delta}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 22 }}>
        <Card padding={0}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #ECECEC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif' }}>Attendance, last 14 days</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, fontFamily: 'Inter, Roboto, sans-serif' }}>Present, late and absent across all branches</div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, fontFamily: 'Inter, Roboto, sans-serif' }}>
              <Legend color="oklch(0.55 0.16 145)" label="Present"/>
              <Legend color="oklch(0.62 0.16 60)" label="Late"/>
              <Legend color="oklch(0.6 0.18 25)" label="Absent"/>
            </div>
          </div>
          <div style={{ padding: '24px 22px 26px' }}>
            <BarChart/>
          </div>
        </Card>
        <Card padding={0}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #ECECEC' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif' }}>Headcount by branch</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, fontFamily: 'Inter, Roboto, sans-serif' }}>Active employees across plants & offices</div>
          </div>
          <div style={{ padding: '20px 22px' }}>
            {[
              { name: 'Mumbai HQ', value: 92, total: 264 },
              { name: 'Raipur Plant', value: 86, total: 264 },
              { name: 'Pune Plant', value: 54, total: 264 },
              { name: 'Delhi Office', value: 32, total: 264 },
            ].map((b, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6, fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <span style={{ color: '#272727', fontWeight: 500 }}>{b.name}</span>
                  <span style={{ color: '#6B7280' }}>{b.value}</span>
                </div>
                <div style={{ height: 8, background: '#F4F4F5', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(b.value/b.total)*100}%`,
                    background: i === 0 ? '#E91E63' : '#272727',
                    borderRadius: 99, transition: 'width 600ms cubic-bezier(.2,.8,.2,1)',
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card padding={0}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #ECECEC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif' }}>Pending approvals</div>
            <Button size="sm" variant="ghost" onClick={() => goTo('leaves')}>View all →</Button>
          </div>
          <div>
            {LEAVES.filter(l => l.status === 'Pending' || l.status === 'In Review').slice(0, 5).map((l, i) => (
              <div key={i} style={{ padding: '14px 22px', borderBottom: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar name={l.name} initials={l.initials} hue={(i * 47) % 360} size={36}/>
                <div style={{ flex: 1, fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{l.type} · {l.days} day{l.days>1?'s':''} · {l.from.slice(5)}</div>
                </div>
                <StatusPill status={l.status}/>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={0}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #ECECEC' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif' }}>Upcoming holidays</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, fontFamily: 'Inter, Roboto, sans-serif' }}>Next 4 in your calendar</div>
          </div>
          <div>
            {HOLIDAYS.slice(0, 5).map((h, i) => {
              const d = new Date(h.date);
              return (
                <div key={i} style={{ padding: '14px 22px', borderBottom: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 46, height: 50, border: '1px solid #ECECEC', borderRadius: 8,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Inter, Roboto, sans-serif',
                  }}>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: '#E91E63', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.toLocaleDateString('en', { month: 'short' })}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#272727', lineHeight: 1 }}>{String(d.getDate()).padStart(2,'0')}</div>
                  </div>
                  <div style={{ flex: 1, fontFamily: 'Inter, Roboto, sans-serif' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{h.branches}</div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: h.kind === 'Public' ? 'oklch(0.95 0.05 250)' : h.kind === 'Regional' ? 'oklch(0.95 0.05 145)' : 'oklch(0.96 0.04 60)',
                    color: h.kind === 'Public' ? 'oklch(0.45 0.13 250)' : h.kind === 'Regional' ? 'oklch(0.4 0.12 145)' : 'oklch(0.5 0.13 60)',
                    fontFamily: 'Inter, Roboto, sans-serif',
                  }}>{h.kind}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

const Legend = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280' }}>
    <span style={{ width: 8, height: 8, borderRadius: 2, background: color }}/>{label}
  </div>
);

const BarChart = () => {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Mon','Tue','Wed','Thu','Fri','Sat','Mon','Tue'];
  const data = [
    [240,18,6],[238,16,10],[245,12,7],[234,22,8],[236,20,8],[180,8,4],
    [241,14,9],[239,17,8],[242,15,7],[244,12,8],[241,14,9],[178,7,3],
    [243,13,8],[241,17,6],
  ];
  const max = 264;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200 }}>
      {data.map((d, i) => {
        const total = d[0] + d[1] + d[2];
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: '100%', height: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ height: `${d[2]/max*100}%`, background: 'oklch(0.6 0.18 25)', borderRadius: '0 0 3px 3px' }}/>
              <div style={{ height: `${d[1]/max*100}%`, background: 'oklch(0.62 0.16 60)' }}/>
              <div style={{ height: `${d[0]/max*100}%`, background: 'oklch(0.55 0.16 145)', borderRadius: '3px 3px 0 0' }}/>
            </div>
            <div style={{ fontSize: 10.5, color: '#9CA3AF', fontFamily: 'Inter, Roboto, sans-serif' }}>{days[i]}</div>
          </div>
        );
      })}
    </div>
  );
};

window.DashboardView = DashboardView;

// ============= EMPLOYEE MASTER =============
const EmployeeView = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [dept, setDept] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [viewing, setViewing] = useState(null);
  const PAGE = 9;

  const filtered = EMPLOYEES.filter(e =>
    (!search || (e.name + e.id + e.designation + e.department).toLowerCase().includes(search.toLowerCase())) &&
    (!branch || e.branch === branch) &&
    (!dept || e.department === dept)
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice((page - 1) * PAGE, page * PAGE);

  const cols = [
    { label: 'Employee', key: 'name', render: r => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={r.name} initials={r.initials} hue={r.avatarHue}/>
        <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{r.name}</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace' }}>{r.id}</div>
        </div>
      </div>
    )},
    { label: 'Department', render: r => (<><div style={{fontWeight:500}}>{r.department}</div><div style={{fontSize:11.5,color:'#9CA3AF',marginTop:2,fontFamily:'Inter, Roboto, sans-serif'}}>{r.grade}</div></>) },
    { label: 'Designation', key: 'designation' },
    { label: 'Location', render: r => (<><div style={{fontWeight:500}}>{r.branchName}</div><div style={{fontSize:11.5,color:'#9CA3AF',marginTop:2,fontFamily:'Inter, Roboto, sans-serif'}}>{r.city}</div></>) },
    { label: 'Status', render: r => <StatusPill status={r.status}/> },
    { label: 'Action', align: 'right', width: 100, render: r => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <IconBtn icon="eye" onClick={(e) => { e.stopPropagation(); setViewing(r); }} />
        <IconBtn icon="pencil" onClick={(e) => { e.stopPropagation(); toast('Opening editor for ' + r.name, 'info'); }} />
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Employee Management"
        subtitle="Manage employee records and information across all branches"
        actions={<>
          <Button icon="upload" variant="secondary" onClick={() => toast('Bulk upload template downloaded', 'success')}>Bulk Upload</Button>
          <Button icon="plus" variant="primary" onClick={() => setShowAdd(true)}>Add Employee</Button>
        </>}
      />

      <Card padding={0}>
        <div style={{ padding: 18, borderBottom: '1px solid #ECECEC' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <TextInput value={search} onChange={setSearch} placeholder="Search employees by name, ID, designation, department…" icon="search" style={{ flex: 1 }}/>
            <Button icon="filter" variant="secondary">Filters</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            <Select value={branch} onChange={setBranch} placeholder="All Branches"
              options={[{ value: '', label: 'All Branches' }, ...BRANCHES.map(b => ({ value: b.id, label: b.name }))]}/>
            <Select value={dept} onChange={setDept} placeholder="All Departments"
              options={[{ value: '', label: 'All Departments' }, ...DEPARTMENTS.map(d => ({ value: d, label: d }))]}/>
            <Select value="" onChange={() => {}} placeholder="All Designations"
              options={[{ value: '', label: 'All Designations' }]}/>
            <Select value="" onChange={() => {}} placeholder="All Status"
              options={[{ value: '', label: 'All Status' }, { value: 'a', label: 'Active' }, { value: 'l', label: 'On Leave' }]}/>
          </div>
        </div>
        <div style={{ padding: '14px 18px', background: '#FAFAFA', borderBottom: '1px solid #ECECEC' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif' }}>Employee Directory</div>
        </div>
        <Table columns={cols} rows={visible} onRowClick={r => setViewing(r)}/>
        <Pagination page={page} pages={pages} setPage={setPage} total={filtered.length} pageSize={PAGE}/>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Employee" width={680}
        footer={<><Button onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" onClick={() => { setShowAdd(false); toast('Employee added — invite sent', 'success'); }}>Save & Invite</Button></>}>
        <AddEmployeeForm/>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Employee Profile" width={640}>
        {viewing && <EmployeeProfile e={viewing}/>}
      </Modal>
    </div>
  );
};

const IconBtn = ({ icon, onClick }) => {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32, height: 32, borderRadius: 8, border: '1px solid transparent',
        background: hover ? '#F4F4F5' : 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280',
      }}>
      <Icon name={icon} size={16}/>
    </button>
  );
};
window.IconBtn = IconBtn;

const Pagination = ({ page, pages, setPage, total, pageSize }) => (
  <div style={{
    padding: '14px 22px', borderTop: '1px solid #ECECEC',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontFamily: 'Inter, Roboto, sans-serif',
  }}>
    <div style={{ fontSize: 12.5, color: '#6B7280' }}>
      Showing <strong style={{color:'#272727'}}>{(page-1)*pageSize+1}</strong> to <strong style={{color:'#272727'}}>{Math.min(page*pageSize,total)}</strong> of <strong style={{color:'#272727'}}>{total}</strong> results
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      <Button size="sm" variant="secondary" disabled={page<=1} onClick={() => setPage(p => p-1)}>Previous</Button>
      {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 5).map(p => (
        <button key={p} onClick={() => setPage(p)} style={{
          width: 32, height: 32, borderRadius: 8, border: '1px solid ' + (p === page ? '#272727' : '#E5E7EB'),
          background: p === page ? '#272727' : '#fff', color: p === page ? '#fff' : '#272727',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, Roboto, sans-serif',
        }}>{p}</button>
      ))}
      <Button size="sm" variant="secondary" disabled={page>=pages} onClick={() => setPage(p => p+1)}>Next</Button>
    </div>
  </div>
);
window.Pagination = Pagination;

const AddEmployeeForm = () => {
  const [step, setStep] = useState(1);
  const steps = ['Basic info', 'Job & department', 'Compensation', 'Review'];
  return (
    <div style={{ padding: 24, fontFamily: 'Inter, Roboto, sans-serif' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ height: 4, background: i+1 <= step ? '#272727' : '#E5E7EB', borderRadius: 2 }}/>
            <div style={{ fontSize: 11.5, color: i+1 === step ? '#272727' : '#9CA3AF', marginTop: 8, fontWeight: i+1 === step ? 600 : 500 }}>{i+1}. {s}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="First name" placeholder="Rohan"/>
        <Field label="Last name" placeholder="Patel"/>
        <Field label="Employee ID" placeholder="CK-EMP-061" disabled value="CK-EMP-061 (auto)"/>
        <Field label="Personal email" placeholder="rohan@example.com"/>
        <Field label="Phone" placeholder="+91 98XXXXXX21"/>
        <Field label="Date of joining" placeholder="DD / MM / YYYY"/>
        <FieldSelect label="Branch" options={['Mumbai HQ','Raipur Plant','Pune Plant','Delhi Office']}/>
        <FieldSelect label="Department" options={DEPARTMENTS}/>
        <FieldSelect label="Designation" options={['Production Supervisor','QA Engineer','Software Engineer']}/>
        <FieldSelect label="Reporting manager" options={['Suresh Kapoor','Lakshmi Iyer','Vivek Rao']}/>
      </div>
      <div style={{ marginTop: 24, padding: 16, background: '#FAFAFA', borderRadius: 10, fontSize: 12.5, color: '#6B7280', display:'flex', gap: 10 }}>
        <Icon name="sparkle" size={16}/>
        <span>Default shift, leave policy and salary structure will be inherited from the selected department. You can override them in steps 2 & 3.</span>
      </div>
    </div>
  );
};

const Field = ({ label, placeholder, disabled, value }) => (
  <div>
    <div style={{ fontSize: 11.5, fontWeight: 500, color: '#6B7280', marginBottom: 6, letterSpacing: '0.02em' }}>{label}</div>
    <input defaultValue={value} placeholder={placeholder} disabled={disabled} style={{
      width: '100%', height: 40, padding: '0 12px', borderRadius: 10,
      border: '1px solid #E5E7EB', fontSize: 13, color: '#272727',
      background: disabled ? '#FAFAFA' : '#fff', fontFamily: 'Inter, Roboto, sans-serif',
      outline: 'none',
    }} onFocus={e => e.target.style.borderColor = '#272727'} onBlur={e => e.target.style.borderColor = '#E5E7EB'}/>
  </div>
);

const FieldSelect = ({ label, options }) => (
  <div>
    <div style={{ fontSize: 11.5, fontWeight: 500, color: '#6B7280', marginBottom: 6, letterSpacing: '0.02em' }}>{label}</div>
    <Select value="" onChange={() => {}} options={[{value:'',label:'Select…'}, ...options.map(o => ({value:o,label:o}))]}/>
  </div>
);

const EmployeeProfile = ({ e }) => (
  <div style={{ padding: 24, fontFamily: 'Inter, Roboto, sans-serif' }}>
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22 }}>
      <Avatar name={e.name} initials={e.initials} hue={e.avatarHue} size={68}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 19, fontWeight: 600, color: '#272727' }}>{e.name}</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{e.designation} · {e.department}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <StatusPill status={e.status}/>
          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#F4F4F5', color: '#4D4D4D' }}>{e.grade}</span>
        </div>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
      {[
        ['Employee ID', e.id], ['Branch', e.branchName], ['Date of joining', e.joined],
        ['Email', e.email], ['Phone', e.phone], ['Reports to', e.manager],
        ['Bank', e.bank + ' ' + e.account], ['Gross / Net', '₹' + e.gross.toLocaleString('en-IN') + ' / ₹' + e.net.toLocaleString('en-IN')],
      ].map(([k, v], i) => (
        <div key={i} style={{ padding: 14, background: '#FAFAFA', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{k}</div>
          <div style={{ fontSize: 13.5, color: '#272727', fontWeight: 500 }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

window.EmployeeView = EmployeeView;

// ============= SHIFTS =============
const ShiftsView = () => {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div>
      <PageHeader
        title="Duty Shifts & Rosters"
        subtitle="Configure shift timings, break rules and roster assignments"
        actions={<>
          <Button icon="calendar" variant="secondary">Roster Calendar</Button>
          <Button icon="plus" variant="primary" onClick={() => setShowCreate(true)}>Create Shift</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        {SHIFTS.slice(0, 3).map((s, i) => (
          <Card key={i} padding={0}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #ECECEC', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, fontFamily: 'Inter, Roboto, sans-serif' }}>{s.kind} Shift</div>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#272727', marginTop: 4, fontFamily: 'Inter, Roboto, sans-serif' }}>{s.name}</div>
              </div>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: i === 0 ? 'oklch(0.95 0.05 70)' : i === 1 ? 'oklch(0.94 0.04 270)' : 'oklch(0.95 0.05 145)',
                color: i === 0 ? 'oklch(0.5 0.13 60)' : i === 1 ? 'oklch(0.45 0.13 270)' : 'oklch(0.42 0.12 145)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="clock" size={18}/>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#272727', letterSpacing: '-0.01em', fontFamily: 'Inter, Roboto, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{s.timing}</div>
              <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 6, fontFamily: 'Inter, Roboto, sans-serif' }}>Break: {s.breakRule}</div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #ECECEC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <Icon name="users" size={15}/>
                  <span style={{ fontSize: 13, color: '#272727', fontWeight: 600 }}>{s.headcount} assigned</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toast('Editing ' + s.name, 'info')}>Edit →</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card padding={0}>
        <SectionHeader title="Roster — Week of 4 May 2026" right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Select value="raipur" onChange={() => {}} size="sm" options={[{value:'raipur',label:'Raipur Plant — Floor A'},{value:'mumbai',label:'Mumbai HQ'}]}/>
            <Button size="sm" variant="ghost" icon="download">Export</Button>
          </div>
        }/>
        <div style={{ padding: 20, overflowX: 'auto' }}>
          <RosterGrid/>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Shift" width={520}
        footer={<><Button onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="primary" onClick={() => { setShowCreate(false); toast('Shift created', 'success'); }}>Create Shift</Button></>}>
        <div style={{ padding: 24, display: 'grid', gap: 14 }}>
          <Field label="Shift name" placeholder="e.g. Production B"/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Start time" placeholder="08:00"/>
            <Field label="End time" placeholder="17:00"/>
          </div>
          <FieldSelect label="Type" options={['General','Production','Office','Field']}/>
          <Field label="Break rule (minutes)" placeholder="45"/>
          <FieldSelect label="Apply to location" options={['Raipur Plant — Floor A','Raipur Plant — Floor B','Mumbai HQ']}/>
        </div>
      </Modal>
    </div>
  );
};

const RosterGrid = () => {
  const days = ['Mon 4', 'Tue 5', 'Wed 6', 'Thu 7', 'Fri 8', 'Sat 9', 'Sun 10'];
  const people = EMPLOYEES.filter(e => e.branch === 'rai').slice(0, 7);
  const pattern = [
    ['D','D','D','D','D','D','OFF'],
    ['N','N','N','N','OFF','OFF','D'],
    ['D','D','D','D','D','OFF','OFF'],
    ['A','A','A','A','A','A','OFF'],
    ['D','D','OFF','D','D','D','OFF'],
    ['B','B','B','B','B','OFF','OFF'],
    ['N','N','N','OFF','OFF','D','D'],
  ];
  const styleFor = (k) => {
    if (k === 'D') return { bg: 'oklch(0.96 0.04 60)', fg: 'oklch(0.5 0.13 60)', label: 'Day 09–18' };
    if (k === 'N') return { bg: 'oklch(0.94 0.04 270)', fg: 'oklch(0.45 0.13 270)', label: 'Night 22–07' };
    if (k === 'A') return { bg: 'oklch(0.96 0.05 200)', fg: 'oklch(0.45 0.14 200)', label: 'Rot. A 06–14' };
    if (k === 'B') return { bg: 'oklch(0.95 0.05 320)', fg: 'oklch(0.45 0.15 320)', label: 'Rot. B 14–22' };
    return { bg: '#F4F4F5', fg: '#9CA3AF', label: 'Off' };
  };
  return (
    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4, minWidth: 920, fontFamily: 'Inter, Roboto, sans-serif' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', width: 220 }}>Employee</th>
          {days.map(d => (
            <th key={d} style={{ padding: '8px 0', fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {people.map((p, i) => (
          <tr key={i}>
            <td style={{ padding: '8px 12px', fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={p.name} initials={p.initials} hue={p.avatarHue} size={28}/>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#272727' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{p.id}</div>
                </div>
              </div>
            </td>
            {pattern[i].map((k, j) => {
              const s = styleFor(k);
              return (
                <td key={j} style={{ padding: 0 }}>
                  <div style={{
                    background: s.bg, color: s.fg, padding: '10px 8px', borderRadius: 7,
                    fontSize: 11, fontWeight: 600, textAlign: 'center', minHeight: 38,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{s.label}</div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

window.ShiftsView = ShiftsView;

// ============= HOLIDAYS =============
const HolidaysView = () => {
  const toast = useToast();
  const [filterKind, setFilterKind] = useState('');
  const filtered = HOLIDAYS.filter(h => !filterKind || h.kind === filterKind);
  return (
    <div>
      <PageHeader
        title="Holiday Calendar"
        subtitle="Public, optional and regional holidays for FY 2026"
        actions={<>
          <Button icon="upload" variant="secondary">Import List</Button>
          <Button icon="plus" variant="primary" onClick={() => toast('New holiday entry', 'info')}>Add Holiday</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        <SmallStat icon="calendar" label="Total holidays" value="14" hint="across all branches"/>
        <SmallStat icon="flag" label="Public" value="8" hint="company-wide"/>
        <SmallStat icon="building" label="Regional" value="3" hint="branch-specific"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <Card padding={0}>
          <SectionHeader title="2026 Holiday list" right={
            <Select size="sm" value={filterKind} onChange={setFilterKind}
              options={[{value:'',label:'All types'},{value:'Public',label:'Public'},{value:'Optional',label:'Optional'},{value:'Regional',label:'Regional'}]}/>
          }/>
          <div>
            {filtered.map((h, i) => {
              const d = new Date(h.date);
              const tones = { Public: 250, Regional: 145, Optional: 60 };
              const tone = tones[h.kind];
              return (
                <div key={i} style={{ padding: '16px 22px', borderBottom: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 10,
                    background: `oklch(0.96 0.04 ${tone})`, color: `oklch(0.4 0.12 ${tone})`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.toLocaleDateString('en', { month: 'short' })}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, marginTop: 2 }}>{String(d.getDate()).padStart(2,'0')}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#272727' }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {h.branches}</div>
                  </div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: `oklch(0.96 0.04 ${tone})`, color: `oklch(0.4 0.13 ${tone})`,
                  }}>{h.kind}</span>
                  <IconBtn icon="pencil" onClick={() => toast('Editing ' + h.name, 'info')}/>
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding={0}>
          <SectionHeader title="May 2026"/>
          <div style={{ padding: 18 }}><MiniCalendar/></div>
        </Card>
      </div>
    </div>
  );
};

const SmallStat = ({ icon, label, value, hint }) => (
  <Card padding={20}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Inter, Roboto, sans-serif' }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#272727', letterSpacing: '-0.02em', fontFamily: 'Inter, Roboto, sans-serif' }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, fontFamily: 'Inter, Roboto, sans-serif' }}>{hint}</div>
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F4F4F5', color: '#272727', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18}/>
      </div>
    </div>
  </Card>
);
window.SmallStat = SmallStat;

const MiniCalendar = () => {
  const days = ['M','T','W','T','F','S','S'];
  // May 2026: 1 May = Friday; 31 days
  const cells = [];
  for (let i = 0; i < 4; i++) cells.push(null); // start fri = 4 offsets
  for (let d = 1; d <= 31; d++) cells.push(d);
  const holiday = { 1: 'Maharashtra Day' };
  const today = 5;
  return (
    <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 600, color: '#9CA3AF', padding: 6, letterSpacing: '0.04em' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((c, i) => {
          const isToday = c === today;
          const isHoliday = c && holiday[c];
          const isWeekend = c && [6, 7, 13, 14, 20, 21, 27, 28].includes(c);
          return (
            <div key={i} style={{
              aspectRatio: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12.5, fontWeight: isToday ? 700 : 500,
              borderRadius: 8,
              background: isToday ? '#272727' : isHoliday ? 'oklch(0.95 0.05 25)' : 'transparent',
              color: isToday ? '#fff' : isHoliday ? 'oklch(0.5 0.16 25)' : isWeekend ? '#9CA3AF' : '#272727',
              cursor: c ? 'pointer' : 'default',
              border: isHoliday ? '1px solid oklch(0.85 0.06 25)' : '1px solid transparent',
            }}>{c || ''}</div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #ECECEC', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#6B7280' }}>
        <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:10,height:10,borderRadius:3,background:'#272727'}}/>Today</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:10,height:10,borderRadius:3,background:'oklch(0.95 0.05 25)',border:'1px solid oklch(0.85 0.06 25)'}}/>Holiday</div>
      </div>
    </div>
  );
};

window.HolidaysView = HolidaysView;

// ============= ATTENDANCE =============
const AttendanceView = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');
  const [shiftF, setShiftF] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const PAGE = 10;

  const filtered = ATTENDANCE.filter(a =>
    (!search || (a.name + a.id).toLowerCase().includes(search.toLowerCase())) &&
    (!statusF || a.status === statusF) &&
    (!shiftF || a.shift === shiftF)
  );
  const visible = filtered.slice((page-1)*PAGE, page*PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const toggle = (id) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };
  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map(v => v.id)));
  };

  const cols = [
    { label: <input type="checkbox" checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} style={{accentColor:'#272727'}}/>, width: 40,
      render: r => <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => { e.stopPropagation(); toggle(r.id); }} style={{accentColor:'#272727'}}/> },
    { label: 'Employee', render: r => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={r.name} initials={r.initials} hue={(r.id.charCodeAt(8) * 17) % 360}/>
        <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{r.name}</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace' }}>{r.id}</div>
        </div>
      </div>
    )},
    { label: 'Department', render: r => (<><div style={{fontWeight:500}}>{r.department}</div><div style={{fontSize:11.5,color:'#9CA3AF',marginTop:2,fontFamily:'Inter, Roboto, sans-serif'}}>{r.designation}</div></>) },
    { label: 'Shift', render: r => (
      <div>
        <div style={{ fontWeight: 500 }}>{r.shift}</div>
        <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: '#F4F4F5', color: '#6B7280', fontWeight: 600, marginTop: 4, display: 'inline-block', fontFamily:'Inter, Roboto, sans-serif' }}>Published</span>
      </div>
    )},
    { label: 'Scheduled', render: r => <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily:'Inter, Roboto, sans-serif' }}>{r.scheduled}</span> },
    { label: 'Actual', render: r => <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily:'Inter, Roboto, sans-serif' }}>{r.actual}</span> },
    { label: 'Duration', align: 'center', render: r => <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter, Roboto, sans-serif', fontWeight: 500 }}>{r.duration}</span> },
    { label: 'Status', render: r => <StatusPill status={r.status}/> },
    { label: 'Exception', render: r => r.exception ? (
      <div style={{ fontSize: 12, fontFamily:'Inter, Roboto, sans-serif' }}>
        <div style={{ color: '#272727', fontWeight: 500 }}>{r.exception}</div>
        <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: 'oklch(0.96 0.04 60)', color: 'oklch(0.5 0.13 60)', fontWeight: 600, marginTop: 4, display: 'inline-block' }}>Pending</span>
      </div>
    ) : <span style={{color: '#D1D5DB'}}>—</span> },
    { label: 'Action', align: 'right', width: 110, render: r => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <IconBtn icon="pencil" onClick={(e) => { e.stopPropagation(); toast('Editing ' + r.name, 'info'); }}/>
        <IconBtn icon="check" onClick={(e) => { e.stopPropagation(); toast('Approved attendance for ' + r.name, 'success'); }}/>
        <IconBtn icon="calendar" onClick={(e) => { e.stopPropagation(); toast('Viewing roster', 'info'); }}/>
      </div>
    )},
  ];

  const stats = {
    present: ATTENDANCE.filter(a => a.status === 'Present').length,
    late: ATTENDANCE.filter(a => a.status === 'Late').length,
    absent: ATTENDANCE.filter(a => a.status === 'Absent').length,
    leave: ATTENDANCE.filter(a => a.status === 'On Leave').length,
  };

  return (
    <div>
      <PageHeader
        title="Attendance & Exceptions"
        subtitle="Monitor attendance and resolve exceptions in real time"
        actions={<>
          <Button icon="upload" variant="secondary">Bulk Upload</Button>
          <Button icon="check" variant="primary" disabled={selected.size === 0}
            onClick={() => { toast(`Approved ${selected.size} entries`, 'success'); setSelected(new Set()); }}>
            Approve {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <PunchStat icon="dot" label="Present" value={stats.present} tone={145}/>
        <PunchStat icon="clock" label="Late" value={stats.late} tone={60}/>
        <PunchStat icon="x" label="Absent" value={stats.absent} tone={25}/>
        <PunchStat icon="leave" label="On Leave" value={stats.leave} tone={250}/>
      </div>

      <Card padding={0}>
        <div style={{ padding: 18, borderBottom: '1px solid #ECECEC' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <TextInput value={search} onChange={setSearch} placeholder="Search employees by name, ID or email…" icon="search" style={{ flex: 1 }}/>
            <Button icon="filter" variant="secondary">Filters</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            <Select value={shiftF} onChange={setShiftF} placeholder="All Shifts"
              options={[{value:'',label:'All Shifts'}, ...SHIFTS.map(s => ({value:s.name,label:s.name}))]}/>
            <Select value="" onChange={() => {}} placeholder="All Departments"
              options={[{value:'',label:'All Departments'}, ...DEPARTMENTS.slice(0,6).map(d => ({value:d,label:d}))]}/>
            <Select value={statusF} onChange={setStatusF} placeholder="All Statuses"
              options={[{value:'',label:'All Statuses'},{value:'Present',label:'Present'},{value:'Late',label:'Late'},{value:'Absent',label:'Absent'},{value:'Half-Day',label:'Half-Day'},{value:'On Leave',label:'On Leave'}]}/>
            <Select value="today" onChange={() => {}} options={[{value:'today',label:'Today, 5 May 2026'},{value:'yesterday',label:'Yesterday'},{value:'week',label:'This week'}]}/>
          </div>
        </div>
        <Table columns={cols} rows={visible}/>
        <Pagination page={page} pages={pages} setPage={setPage} total={filtered.length} pageSize={PAGE}/>
      </Card>
    </div>
  );
};

const PunchStat = ({ icon, label, value, tone }) => (
  <Card padding={18}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `oklch(0.95 0.05 ${tone})`, color: `oklch(0.45 0.13 ${tone})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={20}/>
      </div>
      <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#272727', letterSpacing: '-0.01em', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  </Card>
);

window.AttendanceView = AttendanceView;
