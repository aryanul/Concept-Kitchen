// Views part 2: Salary, Payroll, Loans, Increments, Leaves, Tours, Incentives + stubs

const { BRANCHES: B2, DEPARTMENTS: D2, SHIFTS: S2, EMPLOYEES: E2,
  PAYROLL: P2, LOANS: L2, INCREMENTS: I2, LEAVES: LV2, TOURS: T2, INCENTIVES: IC2, SALARY_GRADES: SG2 } = window.CKData;

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN');

// ============= SALARY MASTER =============
const SalaryView = () => {
  const toast = useToast();
  return (
    <div>
      <PageHeader
        title="Salary Structure & Components"
        subtitle="Define grade-wise salary structures, components and historical records"
        actions={<>
          <Button icon="download" variant="secondary">Export CTC Sheet</Button>
          <Button icon="plus" variant="primary" onClick={() => toast('New grade', 'info')}>Add Grade</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 22 }}>
        {SG2.map((g, i) => (
          <Card key={i} padding={18} style={{ borderColor: i === 2 ? '#272727' : '#ECECEC' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Inter, Roboto, sans-serif' }}>Grade {g.grade}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#272727', marginTop: 6, fontFamily: 'Inter, Roboto, sans-serif' }}>{g.kind}</div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F4F4F5' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'Inter, Roboto, sans-serif' }}>CTC range</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#272727', marginTop: 4, fontFamily: 'Inter, Roboto, sans-serif' }}>{g.ctcRange}</div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Inter, Roboto, sans-serif' }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{g.count} employees</div>
              <Icon name="users" size={14}/>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card padding={0}>
          <SectionHeader title="Salary components" right={<Button size="sm" variant="ghost" icon="plus">Add</Button>}/>
          <div style={{ padding: 8 }}>
            {[
              { name: 'Basic', kind: 'Earning', formula: '50% of CTC', taxable: true },
              { name: 'HRA', kind: 'Earning', formula: '40% of Basic', taxable: true },
              { name: 'Conveyance', kind: 'Earning', formula: 'Flat ₹1,600', taxable: false },
              { name: 'Special Allowance', kind: 'Earning', formula: 'Balancing', taxable: true },
              { name: 'Provident Fund', kind: 'Deduction', formula: '12% of Basic', taxable: false },
              { name: 'Professional Tax', kind: 'Deduction', formula: 'Slab-based', taxable: false },
              { name: 'TDS', kind: 'Deduction', formula: 'Auto, declarations', taxable: false },
            ].map((c, i) => (
              <div key={i} style={{ padding: '12px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'Inter, Roboto, sans-serif' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 36, height: 36, borderRadius: 8,
                  background: c.kind === 'Earning' ? 'oklch(0.95 0.05 145)' : 'oklch(0.96 0.04 60)',
                  color: c.kind === 'Earning' ? 'oklch(0.42 0.12 145)' : 'oklch(0.5 0.13 60)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={c.kind === 'Earning' ? 'arrow-up-right' : 'arrow-down-right'} size={16}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>{c.formula} · {c.taxable ? 'Taxable' : 'Non-taxable'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#F4F4F5', color: '#4D4D4D' }}>{c.kind}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={0}>
          <SectionHeader title="Sample structure — Grade L03" right={<Select size="sm" value="L03" onChange={() => {}} options={[{value:'L01',label:'L01'},{value:'L02',label:'L02'},{value:'L03',label:'L03'},{value:'L04',label:'L04'},{value:'L05',label:'L05'}]}/>}/>
          <div style={{ padding: 22 }}>
            {[
              ['Basic', 28000, 'Earning'],
              ['HRA', 11200, 'Earning'],
              ['Conveyance', 1600, 'Earning'],
              ['Special Allowance', 13200, 'Earning'],
              ['— Gross', 54000, 'Total'],
              ['Provident Fund', -3360, 'Deduction'],
              ['Professional Tax', -200, 'Deduction'],
              ['TDS', -1280, 'Deduction'],
              ['— Net', 49160, 'Total'],
            ].map(([k, v, kind], i) => (
              <div key={i} style={{
                padding: '11px 0', borderBottom: i < 8 ? '1px solid #F4F4F5' : 'none',
                display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter, Roboto, sans-serif',
                fontWeight: kind === 'Total' ? 600 : 500,
                color: kind === 'Total' ? '#272727' : '#4D4D4D',
                fontSize: kind === 'Total' ? 14 : 13,
              }}>
                <span>{k}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: kind === 'Deduction' ? 'oklch(0.5 0.16 25)' : kind === 'Total' ? '#272727' : '#272727' }}>
                  {kind === 'Deduction' ? '−' : ''}{inr(Math.abs(v))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
window.SalaryView = SalaryView;

// ============= PAYROLL =============
const PayrollView = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showRun, setShowRun] = useState(false);
  const [showSlip, setShowSlip] = useState(null);
  const PAGE = 8;

  const filtered = P2.filter(r => !search || (r.name + r.id).toLowerCase().includes(search.toLowerCase()));
  const visible = filtered.slice((page-1)*PAGE, page*PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const totals = useMemo(() => {
    const totalGross = P2.reduce((a, r) => a + r.gross, 0);
    const totalDed = P2.reduce((a, r) => a + r.deduction, 0);
    return {
      processed: P2.length,
      gross: totalGross,
      deductions: totalDed,
      net: totalGross - totalDed,
      bank: Math.floor((totalGross - totalDed) * 0.85),
      cash: Math.floor((totalGross - totalDed) * 0.15),
    };
  }, []);

  const cols = [
    { label: 'Employee', render: r => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={r.name} initials={r.initials} hue={r.avatarHue}/>
        <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{r.name}</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace' }}>{r.id}</div>
        </div>
      </div>
    )},
    { label: 'Department', key: 'department' },
    { label: 'Bank', render: r => (
      <div style={{fontFamily:'Inter, Roboto, sans-serif'}}>
        <div style={{ fontWeight: 500 }}>{r.bank}</div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>{r.account}</div>
      </div>
    )},
    { label: 'Days', align: 'center', render: r => <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily:'Inter, Roboto, sans-serif' }}>{r.paidDays}/{r.daysInMonth}</span> },
    { label: 'OT Hrs', align: 'center', render: r => <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily:'Inter, Roboto, sans-serif' }}>{r.otHours}</span> },
    { label: 'Earning', align: 'right', render: r => (
      <div style={{fontFamily:'Inter, Roboto, sans-serif', fontVariantNumeric: 'tabular-nums', textAlign:'right'}}>
        <div style={{ fontWeight: 600 }}>{inr(r.gross)}</div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>Net {inr(r.net)}</div>
      </div>
    )},
    { label: 'Deduction', align: 'right', render: r => <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily:'Inter, Roboto, sans-serif', color: 'oklch(0.5 0.16 25)' }}>−{inr(r.deduction)}</span> },
    { label: 'Status', render: r => <StatusPill status={r.payStatus}/> },
    { label: 'Action', align: 'right', render: r => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <IconBtn icon="download" onClick={(e) => { e.stopPropagation(); setShowSlip(r); }}/>
        <IconBtn icon="pencil" onClick={(e) => { e.stopPropagation(); toast('Editing payroll for ' + r.name, 'info'); }}/>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Payroll Runs & Pay-slips"
        subtitle="Process monthly payroll and generate tax-ready pay-slips"
        actions={<>
          <Button icon="download" variant="secondary">Bank File</Button>
          <Button icon="payroll" variant="primary" onClick={() => setShowRun(true)}>Run Payroll</Button>
        </>}
      />

      <Card padding={0} style={{ marginBottom: 22 }}>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 0, position: 'relative' }}>
          <PayStat label="Employees" value={totals.processed} hint="processed"/>
          <Divider/>
          <PayStat label="Gross payroll" value={inr(totals.gross)} hint="May 2026" big/>
          <Divider/>
          <PayStat label="Deductions" value={inr(totals.deductions)} hint="PF, PT, TDS" tone="red"/>
          <Divider/>
          <PayStat label="Net pay" value={inr(totals.net)} hint="payable" big/>
          <Divider/>
          <PayStat label="Bank transfer" value={inr(totals.bank)} hint="NEFT batch"/>
          <Divider/>
          <PayStat label="Cash" value={inr(totals.cash)} hint="off-cycle"/>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: 18, borderBottom: '1px solid #ECECEC' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <TextInput value={search} onChange={setSearch} placeholder="Search employees by name, ID or grade…" icon="search" style={{ flex: 1 }}/>
            <Select value="all" onChange={()=>{}} options={[{value:'all',label:'All Departments'}]}/>
            <Select value="may26" onChange={()=>{}} options={[{value:'may26',label:'May 2026'},{value:'apr26',label:'April 2026'}]}/>
            <Button icon="filter" variant="secondary">Filters</Button>
          </div>
        </div>
        <div style={{ padding: '14px 18px', background: '#FAFAFA', borderBottom: '1px solid #ECECEC', fontSize: 13.5, fontWeight: 600, color: '#272727', fontFamily:'Inter, Roboto, sans-serif' }}>Employee Salary Directory</div>
        <Table columns={cols} rows={visible}/>
        <Pagination page={page} pages={pages} setPage={setPage} total={filtered.length} pageSize={PAGE}/>
      </Card>

      <Modal open={showRun} onClose={() => setShowRun(false)} title="Run payroll for May 2026" width={620}
        footer={<><Button onClick={() => setShowRun(false)}>Cancel</Button><Button variant="accent" onClick={() => { setShowRun(false); toast('Payroll initiated for 264 employees', 'success'); }}>Confirm & Run</Button></>}>
        <RunPayrollContent/>
      </Modal>
      <Modal open={!!showSlip} onClose={() => setShowSlip(null)} title="Pay-slip preview" width={580}>
        {showSlip && <PaySlipPreview e={showSlip}/>}
      </Modal>
    </div>
  );
};

const Divider = () => <div style={{ width: 1, background: '#ECECEC', margin: '4px 0' }}/>;
const PayStat = ({ label, value, hint, big, tone }) => (
  <div style={{ padding: '0 22px', fontFamily: 'Inter, Roboto, sans-serif' }}>
    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: big ? 24 : 19, fontWeight: 700, color: tone === 'red' ? 'oklch(0.5 0.16 25)' : '#272727', letterSpacing: '-0.01em', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 4 }}>{hint}</div>
  </div>
);

const RunPayrollContent = () => (
  <div style={{ padding: 24, fontFamily: 'Inter, Roboto, sans-serif' }}>
    <div style={{
      padding: 18, background: 'oklch(0.97 0.02 145)', borderRadius: 10,
      borderLeft: '3px solid oklch(0.55 0.16 145)', marginBottom: 18,
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'oklch(0.32 0.13 145)' }}>All checks passed</div>
      <div style={{ fontSize: 12, color: 'oklch(0.4 0.08 145)', marginTop: 4 }}>Attendance closed · 264 employees ready · 0 exceptions</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {[
        ['Cycle', 'May 2026 (1 — 31 May)'],
        ['Employees', '264'],
        ['Gross', inr(12500000)],
        ['Net payable', inr(11300000)],
        ['Bank file', 'HDFC, ICICI, SBI'],
        ['Cut-off', 'Tonight, 23:59 IST'],
      ].map(([k, v], i) => (
        <div key={i} style={{ padding: 14, background: '#FAFAFA', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{k}</div>
          <div style={{ fontSize: 13.5, color: '#272727', fontWeight: 500 }}>{v}</div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, padding: 14, border: '1px solid #ECECEC', borderRadius: 10 }}>
      <input type="checkbox" defaultChecked style={{ accentColor: '#272727', width: 16, height: 16 }}/>
      <span style={{ fontSize: 13, color: '#4D4D4D' }}>Send pay-slips by email after generation</span>
    </div>
  </div>
);

const PaySlipPreview = ({ e }) => (
  <div style={{ padding: 24, fontFamily: 'Inter, Roboto, sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#272727' }}>Pay-slip for May 2026</div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 4 }}>Concept Kitchen Pvt Ltd · Mumbai</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 12, color: '#9CA3AF' }}>Pay-slip no.</div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#272727' }}>PS-26-05-{e.id.slice(-3)}</div>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
      <Info label="Employee" value={e.name}/>
      <Info label="Employee ID" value={e.id}/>
      <Info label="Department" value={e.department}/>
      <Info label="Designation" value={e.designation}/>
      <Info label="Bank" value={e.bank + ' ' + e.account}/>
      <Info label="Days paid" value={`${e.paidDays}/${e.daysInMonth} · OT ${e.otHours}h`}/>
    </div>
    <div style={{ borderTop: '1px solid #ECECEC', paddingTop: 14 }}>
      {[
        ['Basic', Math.round(e.gross*0.5), '+'],
        ['HRA', Math.round(e.gross*0.2), '+'],
        ['Conveyance', 1600, '+'],
        ['Special Allowance', e.gross - Math.round(e.gross*0.5) - Math.round(e.gross*0.2) - 1600, '+'],
        ['OT Pay', Math.round(e.otHours * 350), '+'],
        ['Provident Fund', Math.round(e.gross*0.06), '−'],
        ['Professional Tax', 200, '−'],
        ['TDS', Math.round(e.deduction - e.gross*0.06 - 200), '−'],
      ].map(([k, v, sign], i) => (
        <div key={i} style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#4D4D4D' }}>
          <span>{k}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: sign === '−' ? 'oklch(0.5 0.16 25)' : '#272727' }}>{sign}{inr(v)}</span>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 14, padding: 14, background: '#272727', color: '#fff', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>Net pay</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{inr(e.net)}</span>
    </div>
  </div>
);
const Info = ({ label, value }) => (
  <div style={{ padding: 12, background: '#FAFAFA', borderRadius: 8 }}>
    <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 13, color: '#272727', fontWeight: 500 }}>{value}</div>
  </div>
);

window.PayrollView = PayrollView;

// ============= LOANS =============
const LoansView = () => {
  const toast = useToast();
  const [showNew, setShowNew] = useState(false);
  const totals = useMemo(() => {
    const principal = L2.reduce((a, l) => a + l.principal, 0);
    const outstanding = L2.reduce((a, l) => a + l.outstanding, 0);
    return { principal, outstanding, recovered: principal - outstanding };
  }, []);

  return (
    <div>
      <PageHeader
        title="Advances & Loans"
        subtitle="Manage employee financial aid, EMIs and one-time deductions"
        actions={<>
          <Button icon="download" variant="secondary">Repayment Report</Button>
          <Button icon="plus" variant="primary" onClick={() => setShowNew(true)}>New Loan / Advance</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        <SmallStat icon="loan" label="Active loans" value={L2.filter(l => l.status === 'Active').length} hint="across departments"/>
        <SmallStat icon="card" label="Outstanding" value={inr(totals.outstanding)} hint={`of ${inr(totals.principal)} disbursed`}/>
        <SmallStat icon="check" label="Recovered" value={inr(totals.recovered)} hint="via payroll EMI"/>
      </div>

      <Card padding={0}>
        <SectionHeader title="All loans & advances" right={<Button size="sm" variant="ghost" icon="filter">Filters</Button>}/>
        <Table
          columns={[
            { label: 'Loan ID', render: r => <span style={{fontFamily:'monospace',fontSize:12.5,color:'#272727',fontWeight:500}}>{r.id}</span> },
            { label: 'Employee', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={r.name} initials={r.initials} hue={(r.empId.charCodeAt(8)*17)%360}/>
                <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace' }}>{r.empId}</div>
                </div>
              </div>
            )},
            { label: 'Type', render: r => <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 999, background: r.kind === 'Loan' ? 'oklch(0.95 0.05 250)' : 'oklch(0.96 0.04 60)', color: r.kind === 'Loan' ? 'oklch(0.45 0.13 250)' : 'oklch(0.5 0.13 60)', fontWeight: 600, fontFamily:'Inter, Roboto, sans-serif' }}>{r.kind}</span> },
            { label: 'Purpose', key: 'purpose' },
            { label: 'Principal', align: 'right', render: r => <span style={{fontVariantNumeric:'tabular-nums',fontFamily:'Inter, Roboto, sans-serif'}}>{inr(r.principal)}</span> },
            { label: 'Outstanding', align: 'right', render: r => <span style={{fontVariantNumeric:'tabular-nums',fontFamily:'Inter, Roboto, sans-serif',fontWeight:600}}>{inr(r.outstanding)}</span> },
            { label: 'EMI', align: 'right', render: r => <span style={{fontVariantNumeric:'tabular-nums',fontFamily:'Inter, Roboto, sans-serif'}}>{inr(r.emi)}</span> },
            { label: 'Progress', render: r => {
              const pct = ((r.principal - r.outstanding) / r.principal) * 100;
              return (
                <div style={{ width: 120, fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <div style={{ height: 6, background: '#F4F4F5', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? 'oklch(0.55 0.16 145)' : '#272727', borderRadius: 99 }}/>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{Math.round(pct)}% paid · {r.remaining} mo left</div>
                </div>
              );
            }},
            { label: 'Status', render: r => <StatusPill status={r.status}/> },
            { label: 'Action', align: 'right', render: r => (
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <IconBtn icon="eye" onClick={() => toast('Viewing ' + r.id, 'info')}/>
                <IconBtn icon="pencil" onClick={() => toast('Editing ' + r.id, 'info')}/>
              </div>
            )},
          ]}
          rows={L2}
        />
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New loan or advance" width={560}
        footer={<><Button onClick={() => setShowNew(false)}>Cancel</Button><Button variant="primary" onClick={() => { setShowNew(false); toast('Submitted for approval', 'success'); }}>Submit for Approval</Button></>}>
        <div style={{ padding: 24, display: 'grid', gap: 14 }}>
          <FieldSelect label="Type" options={['Loan', 'Salary advance']}/>
          <FieldSelect label="Employee" options={E2.slice(0,12).map(e => e.name)}/>
          <Field label="Principal amount" placeholder="₹ 50,000"/>
          <Field label="Tenure (months)" placeholder="12"/>
          <Field label="EMI starts from" placeholder="June 2026"/>
          <Field label="Purpose" placeholder="e.g. Medical emergency"/>
        </div>
      </Modal>
    </div>
  );
};
window.LoansView = LoansView;

// ============= INCREMENTS =============
const IncrementsView = () => {
  const toast = useToast();
  const [tab, setTab] = useState('inflight');
  const stages = ['Submitted', 'Manager Review', 'HR Approval', 'Approved'];

  return (
    <div>
      <PageHeader
        title="Increments & Appraisals"
        subtitle="Performance ratings, role changes and salary hikes with multi-stage approval"
        actions={<>
          <Button icon="download" variant="secondary">Cycle Report</Button>
          <Button icon="plus" variant="primary" onClick={() => toast('New cycle', 'info')}>Start Increment Cycle</Button>
        </>}
      />

      <div style={{ display: 'flex', gap: 4, marginBottom: 22, padding: 4, background: '#F4F4F5', borderRadius: 12, width: 'fit-content' }}>
        {[
          ['inflight','In flight', I2.length],
          ['ratings','Ratings', 132],
          ['history','History', 48],
        ].map(([id, lbl, count]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '9px 16px', borderRadius: 9, border: 'none',
            background: tab === id ? '#fff' : 'transparent',
            color: tab === id ? '#272727' : '#6B7280',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, Roboto, sans-serif',
            boxShadow: tab === id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>{lbl} <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: tab===id?'#F4F4F5':'#E5E7EB', color: '#6B7280' }}>{count}</span></button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {I2.map((inc, i) => {
          const hue = (inc.empId.charCodeAt(8) * 17) % 360;
          return (
            <Card key={i} padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
                <Avatar name={inc.name} initials={inc.initials} hue={hue} size={44}/>
                <div style={{ flex: 1, fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#272727' }}>{inc.name}</div>
                    <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#9CA3AF' }}>{inc.id}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>{inc.dept} · {inc.empId}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                  <div style={{ textAlign: 'right', fontFamily: 'Inter, Roboto, sans-serif' }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#6B7280', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{inr(inc.current)}</div>
                  </div>
                  <Icon name="chevron-right" size={16}/>
                  <div style={{ textAlign: 'right', fontFamily: 'Inter, Roboto, sans-serif' }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Proposed</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#272727', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{inr(inc.proposed)}</div>
                  </div>
                  <div style={{
                    padding: '6px 12px', borderRadius: 999,
                    background: inc.hike >= 10 ? 'oklch(0.95 0.06 340)' : 'oklch(0.95 0.05 145)',
                    color: inc.hike >= 10 ? 'oklch(0.45 0.16 340)' : 'oklch(0.42 0.12 145)',
                    fontSize: 13, fontWeight: 700, fontFamily: 'Inter, Roboto, sans-serif',
                  }}>+{inc.hike}%</div>
                  <StatusPill status={inc.rating}/>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 8 }}>
                {stages.map((s, si) => {
                  const done = si < inc.stageIdx;
                  const active = si === inc.stageIdx;
                  return (
                    <React.Fragment key={si}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: done ? '#272727' : active ? '#fff' : '#F4F4F5',
                          border: done ? '1px solid #272727' : active ? '2px solid #E91E63' : '1px solid #E5E7EB',
                          color: done ? '#fff' : active ? '#E91E63' : '#9CA3AF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, fontFamily: 'Inter, Roboto, sans-serif',
                        }}>
                          {done ? <Icon name="check" size={12} stroke={3}/> : si+1}
                        </div>
                        <span style={{
                          fontSize: 12.5, fontWeight: active || done ? 600 : 500,
                          color: active ? '#272727' : done ? '#272727' : '#9CA3AF',
                          fontFamily: 'Inter, Roboto, sans-serif',
                        }}>{s}</span>
                      </div>
                      {si < stages.length - 1 && <div style={{ flex: 1, height: 1, background: si < inc.stageIdx ? '#272727' : '#E5E7EB', margin: '0 14px' }}/>}
                    </React.Fragment>
                  );
                })}
                <div style={{ marginLeft: 18, display: 'flex', gap: 6 }}>
                  <Button size="sm" variant="secondary" onClick={() => toast('Sent back for revision', 'info')}>Revise</Button>
                  <Button size="sm" variant="primary" onClick={() => toast(inc.name + ' moved to next stage', 'success')}>Approve</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
window.IncrementsView = IncrementsView;

// ============= LEAVES =============
const LeavesView = () => {
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const tabs = [
    ['all', 'All', LV2.length],
    ['Pending', 'Pending', LV2.filter(l => l.status === 'Pending').length],
    ['In Review', 'In Review', LV2.filter(l => l.status === 'In Review').length],
    ['Approved', 'Approved', LV2.filter(l => l.status === 'Approved').length],
  ];
  const visible = tab === 'all' ? LV2 : LV2.filter(l => l.status === tab);

  const balances = [
    { type: 'EL — Earned Leave', allotted: 24, used: 8, color: 250 },
    { type: 'CL — Casual Leave', allotted: 12, used: 5, color: 145 },
    { type: 'SL — Sick Leave', allotted: 12, used: 3, color: 60 },
    { type: 'TOUR — On-duty', allotted: '—', used: 6, color: 340 },
  ];

  return (
    <div>
      <PageHeader
        title="Leaves & Approvals"
        subtitle="Track leave applications, balances and multi-stage approvals"
        actions={<>
          <Button icon="download" variant="secondary">Leave Report</Button>
          <Button icon="plus" variant="primary" onClick={() => toast('Apply on behalf', 'info')}>Apply Leave</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {balances.map((b, i) => (
          <Card key={i} padding={20}>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Inter, Roboto, sans-serif' }}>{b.type}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#272727', letterSpacing: '-0.02em', fontFamily: 'Inter, Roboto, sans-serif' }}>{typeof b.allotted === 'number' ? b.allotted - b.used : b.used}</span>
              <span style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter, Roboto, sans-serif' }}>{typeof b.allotted === 'number' ? `/ ${b.allotted}` : 'days used'}</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 6, fontFamily: 'Inter, Roboto, sans-serif' }}>{typeof b.allotted === 'number' ? `${b.used} used this FY` : 'Tracked separately'}</div>
            <div style={{ height: 4, background: '#F4F4F5', borderRadius: 99, marginTop: 12, overflow: 'hidden' }}>
              {typeof b.allotted === 'number' && (
                <div style={{ height: '100%', width: `${(b.used/b.allotted)*100}%`, background: `oklch(0.55 0.16 ${b.color})`, borderRadius: 99 }}/>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ padding: 14, borderBottom: '1px solid #ECECEC', display: 'flex', alignItems: 'center', gap: 4 }}>
          {tabs.map(([id, lbl, n]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: tab === id ? '#272727' : 'transparent',
              color: tab === id ? '#fff' : '#6B7280',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, Roboto, sans-serif',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>{lbl} <span style={{ fontSize: 11, padding: '0 6px', borderRadius: 6, background: tab===id?'rgba(255,255,255,0.16)':'#F4F4F5' }}>{n}</span></button>
          ))}
          <div style={{ flex: 1 }}/>
          <Button size="sm" variant="ghost" icon="filter">Filters</Button>
        </div>
        <Table
          columns={[
            { label: 'Application', render: r => <span style={{fontFamily:'monospace',fontSize:12.5,color:'#272727',fontWeight:500}}>{r.id}</span> },
            { label: 'Employee', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={r.name} initials={r.initials} hue={(r.empId.charCodeAt(8)*17)%360}/>
                <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{r.department}</div>
                </div>
              </div>
            )},
            { label: 'Type', render: r => <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 6, background: '#F4F4F5', color: '#272727', fontWeight: 600, fontFamily:'Inter, Roboto, sans-serif' }}>{r.type}</span> },
            { label: 'Dates', render: r => <div style={{fontFamily:'Inter, Roboto, sans-serif'}}><div>{r.from.slice(5)} → {r.to.slice(5)}</div><div style={{fontSize:11.5,color:'#9CA3AF',marginTop:2}}>{r.days} day{r.days>1?'s':''}</div></div> },
            { label: 'Reason', render: r => <span style={{fontFamily:'Inter, Roboto, sans-serif',color:'#6B7280',fontSize:12.5}}>{r.reason}</span> },
            { label: 'Balance', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, Roboto, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: '#9CA3AF' }}>{r.before}</span>
                <Icon name="chevron-right" size={12}/>
                <span style={{ fontWeight: 700, color: '#272727' }}>{r.after}</span>
              </div>
            )},
            { label: 'Stage', render: r => <span style={{fontSize:12,color:'#6B7280',fontFamily:'Inter, Roboto, sans-serif'}}>{r.approver}</span> },
            { label: 'Status', render: r => <StatusPill status={r.status}/> },
            { label: 'Action', align: 'right', render: r => (
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {(r.status === 'Pending' || r.status === 'In Review') ? (
                  <>
                    <IconBtn icon="check" onClick={() => toast('Approved ' + r.id, 'success')}/>
                    <IconBtn icon="x" onClick={() => toast('Rejected ' + r.id, 'error')}/>
                  </>
                ) : (
                  <IconBtn icon="eye" onClick={() => toast('Viewing ' + r.id, 'info')}/>
                )}
              </div>
            )},
          ]}
          rows={visible}
        />
      </Card>
    </div>
  );
};
window.LeavesView = LeavesView;

// ============= TOURS =============
const ToursView = () => {
  const toast = useToast();
  return (
    <div>
      <PageHeader
        title="Tour & Travel"
        subtitle="Travel applications, advances and expense settlements"
        actions={<>
          <Button icon="download" variant="secondary">Expense Report</Button>
          <Button icon="plus" variant="primary" onClick={() => toast('New tour', 'info')}>New Tour Request</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        <SmallStat icon="plane" label="Active tours" value={T2.filter(t => t.status !== 'Settled').length} hint="this month"/>
        <SmallStat icon="card" label="Advances paid" value={inr(T2.reduce((a, t) => a + t.advance, 0))} hint="across 4 trips"/>
        <SmallStat icon="check" label="Pending settlement" value={T2.filter(t => t.expense === null).length} hint="awaiting submission"/>
      </div>

      <Card padding={0}>
        <SectionHeader title="Tour applications & settlements"/>
        <Table
          columns={[
            { label: 'Tour ID', render: r => <span style={{fontFamily:'monospace',fontSize:12.5,color:'#272727',fontWeight:500}}>{r.id}</span> },
            { label: 'Employee', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={r.name} initials={r.initials} hue={(r.empId.charCodeAt(8)*17)%360}/>
                <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace' }}>{r.empId}</div>
                </div>
              </div>
            )},
            { label: 'Route', render: r => (
              <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:'Inter, Roboto, sans-serif',fontSize:12.5}}>
                <span style={{color:'#6B7280'}}>{r.from}</span>
                <Icon name="arrow-up-right" size={14}/>
                <span style={{color:'#272727',fontWeight:600}}>{r.to}</span>
              </div>
            )},
            { label: 'Dates', key: 'dates' },
            { label: 'Advance', align: 'right', render: r => <span style={{fontFamily:'Inter, Roboto, sans-serif',fontVariantNumeric:'tabular-nums'}}>{inr(r.advance)}</span> },
            { label: 'Expense', align: 'right', render: r => r.expense ? <span style={{fontFamily:'Inter, Roboto, sans-serif',fontVariantNumeric:'tabular-nums',fontWeight:600}}>{inr(r.expense)}</span> : <span style={{color:'#D1D5DB'}}>—</span> },
            { label: 'Net', align: 'right', render: r => r.expense ? (
              <span style={{fontFamily:'Inter, Roboto, sans-serif',fontVariantNumeric:'tabular-nums',color:r.expense > r.advance ? 'oklch(0.5 0.16 25)' : 'oklch(0.45 0.13 145)',fontWeight:600}}>
                {r.expense > r.advance ? '+' : '−'}{inr(Math.abs(r.expense - r.advance))}
              </span>
            ) : <span style={{color:'#D1D5DB'}}>—</span> },
            { label: 'Status', render: r => <StatusPill status={r.status}/> },
            { label: 'Action', align: 'right', render: r => (
              <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                <IconBtn icon="eye" onClick={() => toast('Viewing ' + r.id, 'info')}/>
                <IconBtn icon="check" onClick={() => toast('Settled ' + r.id, 'success')}/>
              </div>
            )},
          ]}
          rows={T2}
        />
      </Card>
    </div>
  );
};
window.ToursView = ToursView;

// ============= INCENTIVES =============
const IncentivesView = () => {
  const toast = useToast();
  const [selected, setSelected] = useState(new Set());
  const toggle = (id) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };
  const total = IC2.reduce((a, i) => a + i.amount, 0);
  const approved = IC2.filter(i => i.status === 'Approved').reduce((a, i) => a + i.amount, 0);

  return (
    <div>
      <PageHeader
        title="Incentives & Perks"
        subtitle="Performance bonuses, recognitions and bulk push to payroll"
        actions={<>
          <Button icon="upload" variant="secondary">Bulk Upload</Button>
          <Button icon="plus" variant="primary" onClick={() => toast('Add incentive', 'info')}>Add Incentive</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <SmallStat icon="gift" label="Total May" value={inr(total)} hint={`${IC2.length} entries`}/>
        <SmallStat icon="check" label="Approved" value={inr(approved)} hint="ready to push"/>
        <SmallStat icon="clock" label="Pending" value={IC2.filter(i => i.status === 'Pending').length} hint="awaiting manager"/>
        <SmallStat icon="payroll" label="Pushed to payroll" value={IC2.filter(i => i.pushed).length} hint="cycle: May 2026"/>
      </div>

      <Card padding={0}>
        <div style={{ padding: 14, borderBottom: '1px solid #ECECEC', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif', flex: 1 }}>
            All incentives — May 2026 {selected.size > 0 && <span style={{color:'#6B7280',fontWeight:500}}>· {selected.size} selected</span>}
          </div>
          {selected.size > 0 && (
            <>
              <Button size="sm" variant="secondary" onClick={() => { toast(`Approved ${selected.size}`, 'success'); setSelected(new Set()); }}>Approve {selected.size}</Button>
              <Button size="sm" variant="accent" icon="payroll" onClick={() => { toast(`Pushed ${selected.size} to payroll`, 'success'); setSelected(new Set()); }}>Push to Payroll</Button>
            </>
          )}
        </div>
        <Table
          columns={[
            { label: <input type="checkbox" checked={selected.size === IC2.length && IC2.length > 0} onChange={() => selected.size === IC2.length ? setSelected(new Set()) : setSelected(new Set(IC2.map(i => i.id)))} style={{accentColor:'#272727'}}/>, width: 40,
              render: r => <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => { e.stopPropagation(); toggle(r.id); }} style={{accentColor:'#272727'}}/> },
            { label: 'Employee', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={r.name} initials={r.initials} hue={(r.empId.charCodeAt(8)*17)%360}/>
                <div style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#272727' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace' }}>{r.empId}</div>
                </div>
              </div>
            )},
            { label: 'Incentive', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'oklch(0.95 0.06 340)', color: 'oklch(0.45 0.16 340)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="star" size={15}/>
                </div>
                <span style={{ fontWeight: 500, fontFamily: 'Inter, Roboto, sans-serif' }}>{r.kind}</span>
              </div>
            )},
            { label: 'Cycle', render: r => <span style={{fontFamily:'Inter, Roboto, sans-serif'}}>{r.month} 2026</span> },
            { label: 'Amount', align: 'right', render: r => <span style={{fontFamily:'Inter, Roboto, sans-serif',fontVariantNumeric:'tabular-nums',fontWeight:700,fontSize:14}}>{inr(r.amount)}</span> },
            { label: 'Status', render: r => <StatusPill status={r.status}/> },
            { label: 'Pushed?', render: r => r.pushed ? <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 999, background: 'oklch(0.95 0.05 145)', color: 'oklch(0.42 0.12 145)', fontWeight: 600, fontFamily:'Inter, Roboto, sans-serif' }}>In Payroll</span> : <span style={{color:'#9CA3AF',fontSize:12.5,fontFamily:'Inter, Roboto, sans-serif'}}>Not yet</span> },
            { label: 'Action', align: 'right', render: r => (
              <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                <IconBtn icon="pencil" onClick={() => toast('Editing ' + r.id, 'info')}/>
                <IconBtn icon="trash" onClick={() => toast('Removed ' + r.id, 'info')}/>
              </div>
            )},
          ]}
          rows={IC2}
        />
      </Card>
    </div>
  );
};
window.IncentivesView = IncentivesView;

// ============= STUBS =============
const StubView = ({ title, subtitle, icon, message }) => (
  <div>
    <PageHeader title={title} subtitle={subtitle}/>
    <Card padding={64} style={{ textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, margin: '0 auto 18px', borderRadius: 18,
        background: '#F4F4F5', color: '#9CA3AF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon name={icon} size={32} stroke={1.4}/></div>
      <div style={{ fontSize: 17, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif' }}>{title}</div>
      <div style={{ fontSize: 13.5, color: '#6B7280', marginTop: 8, fontFamily: 'Inter, Roboto, sans-serif', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>{message}</div>
      <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <Button variant="secondary">Roadmap</Button>
        <Button variant="primary" icon="plus">Get Started</Button>
      </div>
    </Card>
  </div>
);
window.StubView = StubView;
