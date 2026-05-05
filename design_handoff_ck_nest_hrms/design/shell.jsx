// Sidebar navigation, top bar, and shell

const SIDEBAR_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  {
    id: 'hiring', label: 'Hiring', icon: 'briefcase', children: [
      { id: 'job-profile', label: 'Job Profile' },
      { id: 'vacancy', label: 'Vacancies' },
      { id: 'onboarding', label: 'Onboarding' },
    ]
  },
  {
    id: 'employment', label: 'Employment', icon: 'users', defaultOpen: true, children: [
      { id: 'employee-master', label: 'Employee Master', icon: 'users' },
      { id: 'shifts', label: 'Duty Shifts & Rosters', icon: 'shift' },
      { id: 'holidays', label: 'Holidays', icon: 'calendar' },
      { id: 'attendance', label: 'Attendance & Exceptions', icon: 'attendance' },
      { id: 'salary-master', label: 'Salary Struc. & Compo.', icon: 'salary' },
      { id: 'payroll', label: 'Payroll Runs & Pay-slips', icon: 'payroll' },
      { id: 'loans', label: 'Advances & Loans', icon: 'loan' },
      { id: 'increments', label: 'Increments & Appraisals', icon: 'increment' },
      { id: 'leaves', label: 'Leaves & Approvals', icon: 'leave' },
      { id: 'tours', label: 'Tour & Travel', icon: 'plane' },
      { id: 'incentives', label: 'Incentives & Perks', icon: 'gift' },
    ]
  },
  {
    id: 'relieving', label: 'Relieving', icon: 'logout', children: [
      { id: 'exit-clearance', label: 'Exit Clearance' },
      { id: 'fnf', label: 'Full & Final' },
    ]
  },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const Sidebar = ({ current, setCurrent }) => {
  const [open, setOpen] = useState({ employment: true, hiring: false, relieving: false });
  return (
    <aside style={{
      width: 248, flexShrink: 0, background: '#fff',
      borderRight: '1px solid #ECECEC', display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '22px 22px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="logo" size={36} />
        <div style={{ lineHeight: 1.05, fontFamily: 'Inter, Roboto, sans-serif' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#272727', letterSpacing: '-0.01em' }}>Concept</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#272727', letterSpacing: '-0.01em' }}>kitchen<span style={{color:'#E91E63'}}>.</span></div>
        </div>
      </div>
      <div style={{ padding: '0 12px 16px', flex: 1, overflowY: 'auto' }}>
        {SIDEBAR_NAV.map(item => (
          <div key={item.id} style={{ marginBottom: 2 }}>
            <NavItem
              item={item}
              active={current === item.id}
              expanded={open[item.id]}
              onClick={() => {
                if (item.children) {
                  setOpen(o => ({ ...o, [item.id]: !o[item.id] }));
                } else {
                  setCurrent(item.id);
                }
              }}
            />
            {item.children && open[item.id] && (
              <div style={{ marginTop: 2, marginLeft: 14, paddingLeft: 8, borderLeft: '1px solid #ECECEC' }}>
                {item.children.map(c => (
                  <SubNavItem key={c.id} item={c} active={current === c.id} onClick={() => setCurrent(c.id)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #ECECEC', display:'flex', gap:10, alignItems:'center' }}>
        <Avatar name="Darpan K" hue={340} size={36}/>
        <div style={{ flex: 1, lineHeight: 1.2, fontFamily: 'Inter, Roboto, sans-serif' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#272727' }}>Darpan K.</div>
          <div style={{ fontSize: 11.5, color: '#6B7280' }}>HR Administrator</div>
        </div>
      </div>
    </aside>
  );
};

const NavItem = ({ item, active, expanded, onClick }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
        background: active ? '#272727' : (expanded || hover ? '#F4F4F5' : 'transparent'),
        color: active ? '#fff' : '#272727',
        fontSize: 13.5, fontWeight: 500,
        fontFamily: 'Inter, Roboto, sans-serif',
        transition: 'background 120ms',
      }}
    >
      <Icon name={item.icon} size={18} stroke={active ? 2 : 1.7} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.children && (
        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={16} />
      )}
    </div>
  );
};

const SubNavItem = ({ item, active, onClick }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
        background: active ? '#F4F4F5' : (hover ? '#FAFAFA' : 'transparent'),
        color: active ? '#272727' : '#4D4D4D',
        fontSize: 12.5, fontWeight: active ? 600 : 500,
        fontFamily: 'Inter, Roboto, sans-serif',
        marginBottom: 1,
        transition: 'background 120ms',
      }}
    >
      {item.icon && <Icon name={item.icon} size={15} stroke={active ? 2 : 1.6} />}
      <span>{item.label}</span>
      {active && <span style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'#E91E63' }}/>}
    </div>
  );
};

window.Sidebar = Sidebar;

// ============= TOP BAR =============
const TopBar = ({ onSearch }) => {
  const [q, setQ] = useState('');
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const tStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dStr = time.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  return (
    <div style={{
      padding: '14px 32px', background: '#fff', borderBottom: '1px solid #ECECEC',
      display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{
        flex: 1, maxWidth: 520, height: 42, padding: '0 16px',
        background: '#F4F4F5', borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Icon name="search" size={18} stroke={2}/>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); onSearch && onSearch(e.target.value); }}
          placeholder="Search employees, payroll, leaves…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13.5, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif',
          }}
        />
        <kbd style={{
          padding: '2px 8px', background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 5, fontSize: 11, color: '#6B7280', fontFamily: 'monospace',
        }}>⌘K</kbd>
      </div>
      <div style={{ flex: 1 }}/>
      <Chip icon="clock" label={tStr} />
      <Chip icon="cloud" label="28°C" />
      <Chip icon="calendar" label={dStr} />
      <button style={{
        width: 42, height: 42, borderRadius: 10, border: '1px solid #ECECEC',
        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative', color: '#4D4D4D',
      }}>
        <Icon name="bell" size={18} stroke={1.8}/>
        <span style={{ position: 'absolute', top: 9, right: 11, width: 7, height: 7, borderRadius: '50%', background: '#E91E63', border: '2px solid #fff' }}/>
      </button>
      <div style={{
        height: 42, padding: '0 14px 0 6px', borderRadius: 10, border: '1px solid #ECECEC',
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}>
        <Avatar name="Darpan K" hue={340} size={32}/>
        <div style={{ lineHeight: 1.15, fontFamily: 'Inter, Roboto, sans-serif' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#272727' }}>Darpan</div>
          <div style={{ fontSize: 10.5, color: '#9CA3AF' }}>Admin</div>
        </div>
        <Icon name="chevron-down" size={14}/>
      </div>
    </div>
  );
};

const Chip = ({ icon, label }) => (
  <div style={{
    height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid #ECECEC',
    display: 'flex', alignItems: 'center', gap: 8, color: '#4D4D4D',
    fontSize: 12.5, fontWeight: 500, fontFamily: 'Inter, Roboto, sans-serif', background: '#fff',
  }}>
    <Icon name={icon} size={14} stroke={2}/>
    <span>{label}</span>
  </div>
);

window.TopBar = TopBar;
window.Chip = Chip;
