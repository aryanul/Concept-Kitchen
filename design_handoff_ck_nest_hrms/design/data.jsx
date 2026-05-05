// Mock data for CK Nest HRMS prototype

const BRANCHES = [
  { id: 'mum', name: 'Mumbai HQ', city: 'Mumbai, Maharashtra', kind: 'Office' },
  { id: 'rai', name: 'Raipur Plant', city: 'Raipur, Chhattisgarh', kind: 'Plant' },
  { id: 'del', name: 'Delhi Office', city: 'Delhi, NCR', kind: 'Office' },
  { id: 'pun', name: 'Pune Plant', city: 'Pune, Maharashtra', kind: 'Plant' },
];

const DEPARTMENTS = [
  'Operations', 'Quality Assurance', 'Engineering', 'Finance',
  'Human Resources', 'Logistics', 'IT', 'Marketing', 'Production', 'Maintenance'
];

const SHIFTS = [
  { id: 'day', name: 'Day Shift', timing: '09:00 – 18:00', kind: 'General', breakRule: '45 min', headcount: 184 },
  { id: 'night', name: 'Night Shift', timing: '22:00 – 07:00', kind: 'Production', breakRule: '60 min', headcount: 62 },
  { id: 'rot-a', name: 'Rotational A', timing: '06:00 – 14:00', kind: 'Production', breakRule: '30 min', headcount: 48 },
  { id: 'rot-b', name: 'Rotational B', timing: '14:00 – 22:00', kind: 'Production', breakRule: '30 min', headcount: 44 },
  { id: 'flex', name: 'Flex / Hybrid', timing: '10:00 – 19:00', kind: 'Office', breakRule: '60 min', headcount: 96 },
];

const FIRST_NAMES = ['Rohan','Priya','Dilip','Yatin','Karan','Rahul','Ankit','Harish','Meera','Sneha','Vikram','Anjali','Suresh','Pooja','Arun','Kavya','Manoj','Ritu','Nilesh','Deepa','Sandeep','Geeta','Tarun','Lakshmi','Vivek','Neha','Pradeep','Ishaan','Aditi','Rakesh'];
const LAST_NAMES = ['Patel','Sharma','Shukla','Singh','Tripathi','Kumar','Gupta','Verma','Jain','Mehra','Nair','Iyer','Reddy','Rao','Joshi','Pandey','Mishra','Saxena','Agarwal','Kapoor'];
const DESIGNATIONS = ['Production Supervisor','QA Engineer','Software Engineer','Team Leader','Senior Manager','Plant Manager','Floor Supervisor','Logistics Coordinator','HR Executive','Accounts Executive','Field Officer','Quality Inspector','Maintenance Tech','Senior Developer','Cargo Manager'];
const BANKS = ['HDFC','ICICI','SBI','BOB','IDFC','Axis','Kotak'];
const GRADES = ['L01','L02','L03','L04','L05'];

function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateEmployees(count = 60) {
  const rand = seededRand(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const out = [];
  for (let i = 1; i <= count; i++) {
    const fn = pick(FIRST_NAMES);
    const ln = pick(LAST_NAMES);
    const dept = pick(DEPARTMENTS);
    const branch = pick(BRANCHES);
    const grade = pick(GRADES);
    const baseGross = 18000 + Math.floor(rand() * 80000);
    out.push({
      id: 'CK-EMP-' + String(i).padStart(3, '0'),
      name: fn + ' ' + ln,
      initials: (fn[0] + ln[0]).toUpperCase(),
      designation: pick(DESIGNATIONS),
      department: dept,
      branch: branch.id,
      branchName: branch.name,
      city: branch.city,
      grade,
      shift: pick(SHIFTS).id,
      bank: pick(BANKS),
      account: '*****' + String(1000 + Math.floor(rand() * 9000)),
      gross: baseGross,
      net: Math.floor(baseGross * (0.84 + rand() * 0.06)),
      status: rand() > 0.08 ? 'Active' : 'On Leave',
      joined: '20' + (18 + Math.floor(rand() * 7)) + '-0' + (1 + Math.floor(rand() * 9)) + '-' + (10 + Math.floor(rand() * 18)),
      email: (fn + '.' + ln).toLowerCase() + '@conceptkitchen.in',
      phone: '+91 9' + String(100000000 + Math.floor(rand() * 899999999)).slice(0, 9),
      manager: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES),
      avatarHue: Math.floor(rand() * 360),
    });
  }
  return out;
}

const EMPLOYEES = generateEmployees(60);

// Attendance for today, derived from employees
function generateAttendance() {
  const rand = seededRand(7);
  return EMPLOYEES.slice(0, 24).map((e, i) => {
    const r = rand();
    let status, exception, actual, scheduled;
    const sh = SHIFTS.find(s => s.id === e.shift);
    scheduled = sh.timing;
    if (r < 0.62) {
      status = 'Present';
      exception = null;
      actual = scheduled;
    } else if (r < 0.78) {
      status = 'Late';
      exception = 'Late Arrival';
      const [s, en] = scheduled.split(' – ');
      const mins = (parseInt(s.split(':')[0]) * 60 + parseInt(s.split(':')[1])) + 15 + Math.floor(rand() * 30);
      const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      actual = `${hh}:${mm} – ${en}`;
    } else if (r < 0.88) {
      status = 'Half-Day';
      exception = 'Short Hours';
      actual = scheduled.split(' – ')[0] + ' – 13:30';
    } else if (r < 0.95) {
      status = 'On Leave';
      exception = 'Approved EL';
      actual = '—';
    } else {
      status = 'Absent';
      exception = 'No Punch';
      actual = '—';
    }
    return {
      id: e.id, name: e.name, initials: e.initials, department: e.department,
      designation: e.designation, shift: sh.name, scheduled, actual,
      status, exception,
      duration: status === 'Present' ? '08:00' : status === 'Late' ? '07:30' : status === 'Half-Day' ? '04:00' : '00:00',
      branch: e.branchName,
    };
  });
}
const ATTENDANCE = generateAttendance();

const HOLIDAYS = [
  { date: '2026-01-26', name: 'Republic Day', kind: 'Public', branches: 'All Branches' },
  { date: '2026-03-06', name: 'Holi', kind: 'Public', branches: 'All Branches' },
  { date: '2026-04-14', name: 'Ambedkar Jayanti', kind: 'Optional', branches: 'Mumbai, Pune' },
  { date: '2026-05-01', name: 'Maharashtra Day', kind: 'Regional', branches: 'Mumbai, Pune' },
  { date: '2026-08-15', name: 'Independence Day', kind: 'Public', branches: 'All Branches' },
  { date: '2026-08-30', name: 'Janmashtami', kind: 'Optional', branches: 'All Branches' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', kind: 'Public', branches: 'All Branches' },
  { date: '2026-11-01', name: 'Chhattisgarh Day', kind: 'Regional', branches: 'Raipur Plant' },
  { date: '2026-11-09', name: 'Diwali', kind: 'Public', branches: 'All Branches' },
  { date: '2026-12-25', name: 'Christmas', kind: 'Public', branches: 'All Branches' },
];

const LEAVE_TYPES = ['EL', 'CL', 'SL', 'LWP', 'TOUR', 'COMP-OFF'];

function generateLeaves() {
  const rand = seededRand(99);
  return EMPLOYEES.slice(0, 18).map((e, i) => {
    const type = LEAVE_TYPES[Math.floor(rand() * LEAVE_TYPES.length)];
    const before = 8 + Math.floor(rand() * 18);
    const days = 1 + Math.floor(rand() * 5);
    const r = rand();
    const status = r < 0.5 ? 'Approved' : r < 0.78 ? 'Pending' : r < 0.92 ? 'In Review' : 'Rejected';
    return {
      id: 'LV-' + String(2400 + i).padStart(5, '0'),
      empId: e.id, name: e.name, initials: e.initials, department: e.department,
      type, days,
      from: '2026-05-' + String(10 + Math.floor(rand() * 18)).padStart(2, '0'),
      to: '2026-05-' + String(15 + Math.floor(rand() * 12)).padStart(2, '0'),
      before, after: type === 'LWP' ? before : Math.max(0, before - days),
      status,
      reason: ['Family wedding', 'Medical appointment', 'Personal work', 'Annual vacation', 'Plant visit – Raipur', 'Sick'][Math.floor(rand() * 6)],
      approver: status === 'Approved' ? 'HR Approved' : status === 'Pending' ? 'Awaiting Manager' : status === 'In Review' ? 'With HR' : 'Rejected by Manager',
    };
  });
}
const LEAVES = generateLeaves();

function generatePayroll() {
  return EMPLOYEES.slice(0, 30).map((e, i) => {
    const ot = (Math.round((1 + ((i * 13) % 60) / 10) * 10) / 10);
    const deduction = Math.floor(e.gross * 0.08);
    const r = (i * 7) % 100;
    let status;
    if (r < 60) status = 'Ok';
    else if (r < 78) status = 'Pending';
    else if (r < 92) status = 'Exception';
    else status = 'Hold';
    return {
      ...e,
      daysInMonth: 30,
      presentDays: 26 + (i % 3),
      paidDays: 26 + (i % 3),
      otHours: ot,
      deduction,
      payStatus: status,
    };
  });
}
const PAYROLL = generatePayroll();

const LOANS = [
  { id: 'LN-1042', empId: 'CK-EMP-002', name: 'Priya Sharma', initials: 'PS', kind: 'Loan', principal: 250000, outstanding: 162000, emi: 12500, tenure: '24 mo', remaining: 13, status: 'Active', purpose: 'Home renovation' },
  { id: 'LN-1043', empId: 'CK-EMP-007', name: 'Ankit Kumar', initials: 'AK', kind: 'Advance', principal: 25000, outstanding: 10000, emi: 5000, tenure: '5 mo', remaining: 2, status: 'Active', purpose: 'Medical' },
  { id: 'LN-1044', empId: 'CK-EMP-014', name: 'Vivek Iyer', initials: 'VI', kind: 'Loan', principal: 150000, outstanding: 0, emi: 8500, tenure: '18 mo', remaining: 0, status: 'Closed', purpose: 'Education' },
  { id: 'LN-1045', empId: 'CK-EMP-018', name: 'Sneha Rao', initials: 'SR', kind: 'Advance', principal: 40000, outstanding: 40000, emi: 10000, tenure: '4 mo', remaining: 4, status: 'Pending', purpose: 'Family event' },
  { id: 'LN-1046', empId: 'CK-EMP-025', name: 'Tarun Joshi', initials: 'TJ', kind: 'Loan', principal: 300000, outstanding: 215000, emi: 15000, tenure: '24 mo', remaining: 15, status: 'Active', purpose: 'Vehicle' },
  { id: 'LN-1047', empId: 'CK-EMP-031', name: 'Pooja Verma', initials: 'PV', kind: 'Advance', principal: 30000, outstanding: 30000, emi: 6000, tenure: '5 mo', remaining: 5, status: 'In Review', purpose: 'Personal' },
];

const INCREMENTS = [
  { id: 'INC-2026-014', empId: 'CK-EMP-001', name: 'Rohan Patel', initials: 'RP', dept: 'Operations', current: 480000, proposed: 528000, hike: 10, rating: 'Outstanding', stage: 'HR Approval', stageIdx: 2 },
  { id: 'INC-2026-015', empId: 'CK-EMP-004', name: 'Dilip Sharma', initials: 'DS', dept: 'Quality Assurance', current: 420000, proposed: 450000, hike: 7.1, rating: 'Meets', stage: 'Manager Review', stageIdx: 1 },
  { id: 'INC-2026-016', empId: 'CK-EMP-009', name: 'Meera Jain', initials: 'MJ', dept: 'Engineering', current: 720000, proposed: 828000, hike: 15, rating: 'Outstanding', stage: 'Approved', stageIdx: 3 },
  { id: 'INC-2026-017', empId: 'CK-EMP-012', name: 'Anjali Mehra', initials: 'AM', dept: 'Finance', current: 540000, proposed: 567000, hike: 5, rating: 'Meets', stage: 'Submitted', stageIdx: 0 },
  { id: 'INC-2026-018', empId: 'CK-EMP-021', name: 'Sandeep Pandey', initials: 'SP', dept: 'IT', current: 600000, proposed: 690000, hike: 15, rating: 'Exceeds', stage: 'HR Approval', stageIdx: 2 },
  { id: 'INC-2026-019', empId: 'CK-EMP-027', name: 'Ishaan Saxena', initials: 'IS', dept: 'Marketing', current: 360000, proposed: 378000, hike: 5, rating: 'Meets', stage: 'Manager Review', stageIdx: 1 },
];

const TOURS = [
  { id: 'TR-0421', empId: 'CK-EMP-005', name: 'Yatin Shukla', initials: 'YS', from: 'Mumbai', to: 'Raipur Plant', dates: '12 May – 15 May', advance: 25000, expense: 22400, status: 'Settled' },
  { id: 'TR-0422', empId: 'CK-EMP-011', name: 'Vikram Nair', initials: 'VN', from: 'Delhi', to: 'Pune Plant', dates: '18 May – 19 May', advance: 12000, expense: 10800, status: 'Approved' },
  { id: 'TR-0423', empId: 'CK-EMP-019', name: 'Deepa Reddy', initials: 'DR', from: 'Mumbai', to: 'Client – Bangalore', dates: '22 May – 24 May', advance: 18000, expense: null, status: 'Pending Settlement' },
  { id: 'TR-0424', empId: 'CK-EMP-023', name: 'Geeta Rao', initials: 'GR', from: 'Raipur', to: 'Mumbai HQ', dates: '02 Jun – 03 Jun', advance: 8000, expense: null, status: 'In Review' },
];

const INCENTIVES = [
  { id: 'IN-501', empId: 'CK-EMP-001', name: 'Rohan Patel', initials: 'RP', kind: 'Production Bonus', month: 'May', amount: 8500, status: 'Approved', pushed: false },
  { id: 'IN-502', empId: 'CK-EMP-002', name: 'Priya Sharma', initials: 'PS', kind: 'Quality Award', month: 'May', amount: 5000, status: 'Approved', pushed: true },
  { id: 'IN-503', empId: 'CK-EMP-007', name: 'Ankit Kumar', initials: 'AK', kind: 'Spot Recognition', month: 'May', amount: 2000, status: 'Pending', pushed: false },
  { id: 'IN-504', empId: 'CK-EMP-009', name: 'Meera Jain', initials: 'MJ', kind: 'Performance Bonus', month: 'May', amount: 12000, status: 'Approved', pushed: false },
  { id: 'IN-505', empId: 'CK-EMP-014', name: 'Vivek Iyer', initials: 'VI', kind: 'Referral Bonus', month: 'May', amount: 10000, status: 'In Review', pushed: false },
  { id: 'IN-506', empId: 'CK-EMP-018', name: 'Sneha Rao', initials: 'SR', kind: 'Production Bonus', month: 'May', amount: 7500, status: 'Approved', pushed: true },
  { id: 'IN-507', empId: 'CK-EMP-021', name: 'Sandeep Pandey', initials: 'SP', kind: 'Project Completion', month: 'May', amount: 15000, status: 'Approved', pushed: false },
];

const SALARY_GRADES = [
  { grade: 'L01', kind: 'Trainee / Junior', minGross: 18000, maxGross: 28000, count: 42, ctcRange: '₹2.16L – ₹3.36L' },
  { grade: 'L02', kind: 'Executive', minGross: 28000, maxGross: 45000, count: 78, ctcRange: '₹3.36L – ₹5.4L' },
  { grade: 'L03', kind: 'Senior Executive', minGross: 45000, maxGross: 70000, count: 64, ctcRange: '₹5.4L – ₹8.4L' },
  { grade: 'L04', kind: 'Manager', minGross: 70000, maxGross: 110000, count: 32, ctcRange: '₹8.4L – ₹13.2L' },
  { grade: 'L05', kind: 'Senior Manager', minGross: 110000, maxGross: 200000, count: 18, ctcRange: '₹13.2L – ₹24L' },
];

window.CKData = {
  BRANCHES, DEPARTMENTS, SHIFTS, EMPLOYEES, ATTENDANCE,
  HOLIDAYS, LEAVES, PAYROLL, LOANS, INCREMENTS, TOURS, INCENTIVES, SALARY_GRADES,
};
