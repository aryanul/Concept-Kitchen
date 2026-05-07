import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, DoorOpen, LayoutGrid, LocateFixed, Shield, Sparkles, Tags, Users, Wallet, CalendarDays, ClipboardList } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/StatusPill';
import { Avatar } from '../../components/ui/Avatar';
import { inrPaiseToRupeesShort, formatDate } from '../../lib/format';
import { MasterCrudPage, type MasterField } from '../../components/masters/MasterCrudPage';
import { HolidaysPage } from '../holidays/HolidaysPage';

type Branch = { id: string; code: string; name: string; city: string; kind: string };
type Shift = { id: string; code: string; name: string; start_time: string; end_time: string; kind: string; break_min: number };
type SalaryGrade = { id: string; code: string; kind: string; min_gross: number | string; max_gross: number | string; employee_count?: number | string };
type Division = { id: string; code: string | null; name: string; description: string | null; is_active: number | boolean };
type Designation = {
  id: string;
  code: string | null;
  name: string;
  department_id: string | null;
  division_id: string | null;
  parent_designation_id: string | null;
  hierarchy_level: number | string;
  is_active: number | boolean;
  department_name?: string | null;
  division_name?: string | null;
  parent_designation_name?: string | null;
};
type Location = { id: string; code: string | null; name: string; city: string | null; state: string | null; branch_id: string | null; branch_name?: string | null; is_active: number | boolean };
type Skill = { id: string; code: string | null; name: string; category: string | null; description: string | null; is_active: number | boolean };
type Company = { id: string; lc_no: string; name: string; branch: string | null; city: string | null; location: string | null };
type InterviewTemplate = { id: string; title: string; description: string | null; image_url: string | null; is_default: number | boolean };
type GiveawayTemplate = { id: string; name: string; is_default: number | boolean };
type UserRow = { id: string; email: string; role: string; employee_id: string | null; employee_code?: string | null; first_name?: string | null; last_name?: string | null };
type Department = { id: string; name: string };

export function MastersHomePage() {
  const cards = [
    { title: 'DDD Master', desc: 'Departments, divisions and designations', to: '/masters/ddd', icon: LayoutGrid },
    { title: 'Branches', desc: 'Branch codes, cities and types', to: '/masters/branches', icon: Building2 },
    { title: 'Locations', desc: 'Office and site locations', to: '/masters/locations', icon: LocateFixed },
    { title: 'Shifts', desc: 'Duty shift definitions', to: '/masters/shifts', icon: CalendarDays },
    { title: 'Salary Grades', desc: 'Grade ladder and pay bands', to: '/masters/salary-grades', icon: Wallet },
    { title: 'Skills', desc: 'Skill master for designations', to: '/masters/skills', icon: Sparkles },
    { title: 'Companies', desc: 'Hiring company master', to: '/masters/companies', icon: Building2 },
    { title: 'Users', desc: 'User console and role access', to: '/masters/users', icon: Shield },
    { title: 'Interview Templates', desc: 'Hiring template library', to: '/masters/interview-templates', icon: ClipboardList },
    { title: 'Giveaways', desc: 'Onboarding giveaway templates', to: '/masters/giveaways', icon: GiftIcon },
    { title: 'Holidays', desc: 'Holiday master', to: '/holidays', icon: CalendarDays },
  ];

  return (
    <div>
      <PageHeader title="Masters" subtitle="Maintain reference data used across the HRMS." />
      <div className="ck-stats-4">
        {cards.map((card) => (
          <Card key={card.title} padding={20}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <card.icon size={18} style={{ color: 'var(--ck-muted)' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 4 }}>{card.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 14 }}>{card.desc}</div>
            <Link to={card.to} style={{ color: 'var(--ck-accent)', fontSize: 12.5, fontWeight: 600 }}>Open</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function BranchMasterPage() {
  return (
    <MasterCrudPage<Branch>
      title="Branch Master"
      subtitle="Manage branch codes, cities and branch kinds."
      endpoint="/branches"
      columns={[
        { header: 'Code', render: (row) => <Mono>{row.code}</Mono> },
        { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
        { header: 'City', render: (row) => row.city },
        { header: 'Kind', render: (row) => row.kind },
      ]}
      buildFields={() => [
        { name: 'code', label: 'Code', type: 'text', placeholder: 'BR001' },
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Mumbai Head Office', required: true },
        { name: 'city', label: 'City', type: 'text', placeholder: 'Mumbai', required: true },
        { name: 'kind', label: 'Kind', type: 'text', placeholder: 'HQ / Plant / Office', required: true },
      ]}
      rowToValues={(row) => row ? { code: row.code, name: row.name, city: row.city, kind: row.kind } : { code: '', name: '', city: '', kind: '' }}
      buildPayload={(values) => ({
        code: values.code || undefined,
        name: values.name,
        city: values.city,
        kind: values.kind,
      })}
      searchKeys={['code', 'name', 'city', 'kind']}
    />
  );
}

export function ShiftMasterPage() {
  return (
    <MasterCrudPage<Shift>
      title="Shift Master"
      subtitle="Define shift windows, kinds and break time."
      endpoint="/shifts"
      columns={[
        { header: 'Code', render: (row) => <Mono>{row.code}</Mono> },
        { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
        { header: 'Timing', render: (row) => `${row.start_time} - ${row.end_time}` },
        { header: 'Kind', render: (row) => row.kind },
        { header: 'Break', render: (row) => `${row.break_min} min` },
      ]}
      buildFields={() => [
        { name: 'code', label: 'Code', type: 'text', placeholder: 'SH001' },
        { name: 'name', label: 'Name', type: 'text', placeholder: 'General Shift', required: true },
        { name: 'startTime', label: 'Start Time', type: 'text', placeholder: '09:00', required: true },
        { name: 'endTime', label: 'End Time', type: 'text', placeholder: '18:00', required: true },
        { name: 'kind', label: 'Kind', type: 'text', placeholder: 'General / Production / Office', required: true },
        { name: 'breakMin', label: 'Break (min)', type: 'number', placeholder: '45', required: true },
      ]}
      rowToValues={(row) => row ? { code: row.code, name: row.name, startTime: row.start_time, endTime: row.end_time, kind: row.kind, breakMin: row.break_min } : { code: '', name: '', startTime: '', endTime: '', kind: '', breakMin: 45 }}
      buildPayload={(values) => ({
        code: values.code || undefined,
        name: values.name,
        startTime: values.startTime,
        endTime: values.endTime,
        kind: values.kind,
        breakMin: Number(values.breakMin || 0),
      })}
      searchKeys={['code', 'name', 'kind']}
    />
  );
}

export function SalaryGradeMasterPage() {
  return (
    <MasterCrudPage<SalaryGrade>
      title="Salary Grade Master"
      subtitle="Maintain salary bands used by employees and payroll."
      endpoint="/salary-grades"
      columns={[
        { header: 'Code', render: (row) => <Mono>{row.code}</Mono> },
        { header: 'Kind', render: (row) => row.kind },
        { header: 'Min Gross', render: (row) => inrPaiseToRupeesShort(row.min_gross) },
        { header: 'Max Gross', render: (row) => inrPaiseToRupeesShort(row.max_gross) },
        { header: 'Headcount', render: (row) => Number(row.employee_count ?? 0) },
      ]}
      buildFields={() => [
        { name: 'code', label: 'Code', type: 'text', placeholder: 'SG001' },
        { name: 'kind', label: 'Kind', type: 'text', placeholder: 'Junior / Mid / Senior', required: true },
        { name: 'minGross', label: 'Min Gross', type: 'number', placeholder: '25000', required: true },
        { name: 'maxGross', label: 'Max Gross', type: 'number', placeholder: '45000', required: true },
      ]}
      rowToValues={(row) => row ? { code: row.code, kind: row.kind, minGross: Number(row.min_gross) / 100, maxGross: Number(row.max_gross) / 100 } : { code: '', kind: '', minGross: '', maxGross: '' }}
      buildPayload={(values) => ({
        code: values.code || undefined,
        kind: values.kind,
        minGross: Number(values.minGross || 0),
        maxGross: Number(values.maxGross || 0),
      })}
      searchKeys={['code', 'kind']}
    />
  );
}

export function DivisionMasterPage() {
  return (
    <MasterCrudPage<Division>
      title="Division Master"
      subtitle="Maintain divisions used by the DDD master and job profiles."
      endpoint="/divisions"
      columns={[
        { header: 'Code', render: (row) => <Mono>{row.code ?? '—'}</Mono> },
        { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
        { header: 'Description', render: (row) => row.description ?? '—' },
        { header: 'Status', render: (row) => <StatusPill status={Number(row.is_active) ? 'Active' : 'Inactive'} /> },
      ]}
      buildFields={() => [
        { name: 'code', label: 'Code', type: 'text', placeholder: 'DIV001' },
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Operations', required: true },
        { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional notes', span: true },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: true },
      ]}
      rowToValues={(row) => row ? { code: row.code ?? '', name: row.name, description: row.description ?? '', isActive: Boolean(row.is_active) } : { code: '', name: '', description: '', isActive: true }}
      buildPayload={(values) => ({ code: values.code || undefined, name: values.name, description: values.description || undefined, isActive: Boolean(values.isActive) })}
      searchKeys={['code', 'name', 'description']}
    />
  );
}

export function SkillsMasterPage() {
  return (
    <MasterCrudPage<Skill>
      title="Skill Master"
      subtitle="Manage the skill dictionary used in designation and role setup."
      endpoint="/skills"
      columns={[
        { header: 'Code', render: (row) => <Mono>{row.code ?? '—'}</Mono> },
        { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
        { header: 'Category', render: (row) => row.category ?? '—' },
        { header: 'Description', render: (row) => row.description ?? '—' },
        { header: 'Status', render: (row) => <StatusPill status={Number(row.is_active) ? 'Active' : 'Inactive'} /> },
      ]}
      buildFields={() => [
        { name: 'code', label: 'Code', type: 'text', placeholder: 'SK001' },
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Leadership', required: true },
        { name: 'category', label: 'Category', type: 'text', placeholder: 'Soft skill / Technical' },
        { name: 'description', label: 'Description', type: 'textarea', span: true },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: true },
      ]}
      rowToValues={(row) => row ? { code: row.code ?? '', name: row.name, category: row.category ?? '', description: row.description ?? '', isActive: Boolean(row.is_active) } : { code: '', name: '', category: '', description: '', isActive: true }}
      buildPayload={(values) => ({ code: values.code || undefined, name: values.name, category: values.category || undefined, description: values.description || undefined, isActive: Boolean(values.isActive) })}
      searchKeys={['code', 'name', 'category', 'description']}
    />
  );
}

export function LocationMasterPage() {
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    api.get('/branches').then((r) => setBranches(Array.isArray(r.data?.data) ? r.data.data : [])).catch(() => setBranches([]));
  }, []);

  return (
    <MasterCrudPage<Location>
      title="Location Master"
      subtitle="Maintain branch-linked location records."
      endpoint="/locations"
      columns={[
        { header: 'Code', render: (row) => <Mono>{row.code ?? '—'}</Mono> },
        { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
        { header: 'City', render: (row) => row.city ?? '—' },
        { header: 'State', render: (row) => row.state ?? '—' },
        { header: 'Branch', render: (row) => row.branch_name ?? '—' },
      ]}
      buildFields={() => [
        { name: 'code', label: 'Code', type: 'text', placeholder: 'LOC001' },
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Andheri Office', required: true },
        { name: 'city', label: 'City', type: 'text', placeholder: 'Mumbai' },
        { name: 'state', label: 'State', type: 'text', placeholder: 'Maharashtra' },
        { name: 'branchId', label: 'Branch', type: 'select', options: branches.map((branch) => ({ label: `${branch.name} (${branch.code})`, value: branch.id })) },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: true },
      ]}
      rowToValues={(row) => row ? { code: row.code ?? '', name: row.name, city: row.city ?? '', state: row.state ?? '', branchId: row.branch_id ?? '', isActive: Boolean(row.is_active) } : { code: '', name: '', city: '', state: '', branchId: '', isActive: true }}
      buildPayload={(values) => ({ code: values.code || undefined, name: values.name, city: values.city || undefined, state: values.state || undefined, branchId: values.branchId || undefined, isActive: Boolean(values.isActive) })}
      searchKeys={['code', 'name', 'city', 'state']}
    />
  );
}

export function CompanyMasterPage() {
  return (
    <MasterCrudPage<Company>
      title="Company Master"
      subtitle="Manage hiring companies used in vacancy and alumni flows."
      endpoint="/hiring/companies"
      pageSize={1000}
      columns={[
        { header: 'LC No.', render: (row) => <Mono>{row.lc_no}</Mono> },
        { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
        { header: 'Branch', render: (row) => row.branch ?? '—' },
        { header: 'City', render: (row) => row.city ?? '—' },
        { header: 'Location', render: (row) => row.location ?? '—' },
      ]}
      buildFields={() => [
        { name: 'lcNo', label: 'LC No.', type: 'text', placeholder: 'LC001' },
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Concept Kitchen', required: true },
        { name: 'branch', label: 'Branch', type: 'text', placeholder: 'Head Office' },
        { name: 'city', label: 'City', type: 'text', placeholder: 'Mumbai' },
        { name: 'location', label: 'Location', type: 'textarea', span: true },
      ]}
      rowToValues={(row) => row ? { lcNo: row.lc_no, name: row.name, branch: row.branch ?? '', city: row.city ?? '', location: row.location ?? '' } : { lcNo: '', name: '', branch: '', city: '', location: '' }}
      buildPayload={(values) => ({ lcNo: values.lcNo || undefined, name: values.name, branch: values.branch || undefined, city: values.city || undefined, location: values.location || undefined })}
      searchKeys={['lc_no', 'name', 'branch', 'city', 'location']}
    />
  );
}

export function InterviewTemplateMasterPage() {
  return (
    <MasterCrudPage<InterviewTemplate>
      title="Interview Templates"
      subtitle="Template cards used in the hiring workflow."
      endpoint="/hiring/interview-templates"
      columns={[
        { header: 'Title', render: (row) => <Strong>{row.title}</Strong> },
        { header: 'Description', render: (row) => row.description ?? '—' },
        { header: 'Default', render: (row) => <StatusPill status={Number(row.is_default) ? 'Default' : 'Custom'} /> },
      ]}
      buildFields={() => [
        { name: 'title', label: 'Title', type: 'text', placeholder: 'Interview template title', required: true },
        { name: 'description', label: 'Description', type: 'textarea', span: true },
        { name: 'imageUrl', label: 'Image URL', type: 'text', placeholder: 'https://...', span: true },
        { name: 'isDefault', label: 'Default', type: 'checkbox', span: true },
      ]}
      rowToValues={(row) => row ? { title: row.title, description: row.description ?? '', imageUrl: row.image_url ?? '', isDefault: Boolean(row.is_default) } : { title: '', description: '', imageUrl: '', isDefault: false }}
      buildPayload={(values) => ({ title: values.title, description: values.description || undefined, imageUrl: values.imageUrl || undefined, isDefault: Boolean(values.isDefault) })}
      searchKeys={['title', 'description']}
    />
  );
}

export function GiveawayTemplateMasterPage() {
  return (
    <MasterCrudPage<GiveawayTemplate>
      title="Onboarding Giveaways"
      subtitle="Gift items or kit templates used in onboarding."
      endpoint="/onboarding/giveaways"
      columns={[
        { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
        { header: 'Default', render: (row) => <StatusPill status={Number(row.is_default) ? 'Default' : 'Custom'} /> },
      ]}
      buildFields={() => [
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Welcome kit', required: true },
        { name: 'isDefault', label: 'Default', type: 'checkbox', span: true },
      ]}
      rowToValues={(row) => row ? { name: row.name, isDefault: Boolean(row.is_default) } : { name: '', isDefault: false }}
      buildPayload={(values) => ({ name: values.name, isDefault: Boolean(values.isDefault) })}
      searchKeys={['name']}
    />
  );
}

export function UserConsolePage() {
  const [employees, setEmployees] = useState<Array<{ id: string; code: string; first_name: string; last_name: string }>>([]);

  useEffect(() => {
    api.get('/employees', { params: { page: 1, pageSize: 1000 } }).then((r) => {
      const list = Array.isArray(r.data?.data) ? r.data.data : [];
      setEmployees(list);
    }).catch(() => setEmployees([]));
  }, []);

  const employeeOptions = employees.map((employee) => ({ label: `${employee.first_name} ${employee.last_name} (${employee.code})`, value: employee.id }));

  return (
    <MasterCrudPage<UserRow>
      title="User Console"
      subtitle="Manage app users, roles and employee links."
      endpoint="/users"
      columns={[
        { header: 'Email', render: (row) => <Strong>{row.email}</Strong> },
        { header: 'Role', render: (row) => row.role },
        { header: 'Employee', render: (row) => row.employee_code ? `${row.employee_code}` : '—' },
      ]}
      buildFields={() => [
        { name: 'email', label: 'Email', type: 'text', placeholder: 'hr@cknest.local', required: true },
        { name: 'password', label: 'Password', type: 'text', placeholder: 'Set on create / reset on edit' },
        { name: 'role', label: 'Role', type: 'select', options: [
          { label: 'HR Admin', value: 'HR_ADMIN' },
          { label: 'Manager', value: 'MANAGER' },
          { label: 'Employee', value: 'EMPLOYEE' },
          { label: 'Finance', value: 'FINANCE' },
        ], required: true },
        { name: 'employeeId', label: 'Employee', type: 'select', options: employeeOptions },
      ]}
      rowToValues={(row) => row ? { email: row.email, password: '', role: row.role, employeeId: row.employee_id ?? '' } : { email: '', password: '', role: 'HR_ADMIN', employeeId: '' }}
      buildPayload={(values) => ({
        email: values.email,
        password: values.password || undefined,
        role: values.role,
        employeeId: values.employeeId || undefined,
      })}
      searchKeys={['email', 'role']}
    />
  );
}

export function DddMasterPage() {
  const [tab, setTab] = useState<'department' | 'division' | 'designation'>('department');
  const [rows, setRows] = useState<Department[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    api.get('/departments').then((r) => setRows(Array.isArray(r.data?.data) ? r.data.data : [])).catch(() => setRows([]));
    api.get('/divisions').then((r) => setDivisions(Array.isArray(r.data?.data) ? r.data.data : [])).catch(() => setDivisions([]));
    api.get('/designations').then((r) => setDesignations(Array.isArray(r.data?.data) ? r.data.data : [])).catch(() => setDesignations([]));
  }, [reloadToken]);

  const divisionOptions = divisions.map((division) => ({ label: division.name, value: division.id }));
  const departmentOptions = rows.map((department) => ({ label: department.name, value: department.id }));
  const designationOptions = designations.map((designation) => ({ label: designation.name, value: designation.id }));

  return (
    <div>
      <PageHeader title="DDD Master" subtitle="Departments, divisions and designations managed in one place." />
      <Card padding={0}>
        <div style={{ display: 'flex', gap: 4, padding: 12, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap' }}>
          {[
            { key: 'department', label: 'Department' },
            { key: 'division', label: 'Division' },
            { key: 'designation', label: 'Designation' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as typeof tab)}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: tab === item.key ? 'var(--ck-ink)' : 'transparent',
                color: tab === item.key ? '#fff' : 'var(--ck-muted)', fontWeight: 600,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 0 }}>
          {tab === 'department' && (
            <MasterCrudPage<Department>
              title="Department Master"
              subtitle="Manage department names used across employees and job profiles."
              endpoint="/departments"
              onChanged={() => setReloadToken((v) => v + 1)}
              addLabel="Add Department"
              columns={[
                { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
              ]}
              buildFields={() => [
                { name: 'name', label: 'Name', type: 'text', placeholder: 'Operations', required: true },
              ]}
              rowToValues={(row) => row ? { name: row.name } : { name: '' }}
              buildPayload={(values) => ({ name: values.name })}
              searchKeys={['name']}
            />
          )}
          {tab === 'division' && (
            <MasterCrudPage<Division>
              title="Division Master"
              subtitle="Manage divisions used in the DDD master."
              endpoint="/divisions"
              onChanged={() => setReloadToken((v) => v + 1)}
              addLabel="Add Division"
              columns={[
                { header: 'Code', render: (row) => <Mono>{row.code ?? '—'}</Mono> },
                { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
                { header: 'Description', render: (row) => row.description ?? '—' },
                { header: 'Status', render: (row) => <StatusPill status={Number(row.is_active) ? 'Active' : 'Inactive'} /> },
              ]}
              buildFields={() => [
                { name: 'code', label: 'Code', type: 'text', placeholder: 'DIV001' },
                { name: 'name', label: 'Name', type: 'text', placeholder: 'Operations', required: true },
                { name: 'description', label: 'Description', type: 'textarea', span: true },
                { name: 'isActive', label: 'Active', type: 'checkbox', span: true },
              ]}
              rowToValues={(row) => row ? { code: row.code ?? '', name: row.name, description: row.description ?? '', isActive: Boolean(row.is_active) } : { code: '', name: '', description: '', isActive: true }}
              buildPayload={(values) => ({ code: values.code || undefined, name: values.name, description: values.description || undefined, isActive: Boolean(values.isActive) })}
              searchKeys={['code', 'name', 'description']}
            />
          )}
          {tab === 'designation' && (
            <MasterCrudPage<Designation>
              title="Designation Master"
              subtitle="Manage designation hierarchy and map to department/division."
              endpoint="/designations"
              onChanged={() => setReloadToken((v) => v + 1)}
              addLabel="Add Designation"
              columns={[
                { header: 'Code', render: (row) => <Mono>{row.code ?? '—'}</Mono> },
                { header: 'Name', render: (row) => <Strong>{row.name}</Strong> },
                { header: 'Department', render: (row) => row.department_name ?? '—' },
                { header: 'Division', render: (row) => row.division_name ?? '—' },
                { header: 'Level', render: (row) => String(row.hierarchy_level) },
                { header: 'Status', render: (row) => <StatusPill status={Number(row.is_active) ? 'Active' : 'Inactive'} /> },
              ]}
              buildFields={() => [
                { name: 'code', label: 'Code', type: 'text', placeholder: 'DES001' },
                { name: 'name', label: 'Name', type: 'text', placeholder: 'Team Leader', required: true },
                { name: 'departmentId', label: 'Department', type: 'select', options: departmentOptions },
                { name: 'divisionId', label: 'Division', type: 'select', options: divisionOptions },
                { name: 'parentDesignationId', label: 'Parent Designation', type: 'select', options: designationOptions },
                { name: 'hierarchyLevel', label: 'Hierarchy Level', type: 'number', placeholder: '0' },
                { name: 'isActive', label: 'Active', type: 'checkbox', span: true },
              ]}
              rowToValues={(row) => row ? { code: row.code ?? '', name: row.name, departmentId: row.department_id ?? '', divisionId: row.division_id ?? '', parentDesignationId: row.parent_designation_id ?? '', hierarchyLevel: row.hierarchy_level, isActive: Boolean(row.is_active) } : { code: '', name: '', departmentId: '', divisionId: '', parentDesignationId: '', hierarchyLevel: 0, isActive: true }}
              buildPayload={(values) => ({ code: values.code || undefined, name: values.name, departmentId: values.departmentId || undefined, divisionId: values.divisionId || undefined, parentDesignationId: values.parentDesignationId || undefined, hierarchyLevel: Number(values.hierarchyLevel || 0), isActive: Boolean(values.isActive) })}
              searchKeys={['code', 'name', 'department_name', 'division_name']}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

export function HolidayMasterPage() {
  return <HolidaysPage />;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{children}</span>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: 'var(--ck-font-mono)', color: 'var(--ck-ink-soft)', fontSize: 12.5 }}>{children}</span>;
}

function GiftIcon(props: { size?: number; style?: React.CSSProperties }) {
  return <Sparkles {...props} />;
}
