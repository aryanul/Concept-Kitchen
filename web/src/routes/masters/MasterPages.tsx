import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, LayoutGrid, LocateFixed, Shield, Sparkles, Wallet, CalendarDays, ClipboardList, BookOpen, ListChecks, Tag, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { inrPaiseToRupeesShort } from '../../lib/format';
import { MasterCrudPage } from '../../components/masters/MasterCrudPage';
import { HolidaysPage } from '../holidays/HolidaysPage';
import { ShiftsPage } from '../shifts/ShiftsPage';

type Branch = { id: string; code: string; name: string; city: string; kind: string };
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
type TrainingModule = { id: string; code: string; name: string; description: string | null; cover_image_url: string | null; chapter_count: number | string; duration_hours: number | string | null; is_active: number | boolean };
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
    { title: 'Training Modules', desc: 'Course modules for job profiles', to: '/masters/training-modules', icon: BookOpen },
    { title: 'Companies', desc: 'Hiring company master', to: '/masters/companies', icon: Building2 },
    { title: 'Users', desc: 'User console and role access', to: '/masters/users', icon: Shield },
    { title: 'Interview Templates', desc: 'Hiring template library', to: '/masters/interview-templates', icon: ClipboardList },
    { title: 'Giveaways', desc: 'Onboarding giveaway templates', to: '/masters/giveaways', icon: GiftIcon },
    { title: 'Holidays', desc: 'Holiday master', to: '/holidays', icon: CalendarDays },
    { title: 'Lookups', desc: 'Hiring statuses, sources, modes etc.', to: '/masters/lookups', icon: ListChecks },
    { title: 'Tags', desc: 'Applicant tag library', to: '/masters/tags', icon: Tag },
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
  return <ShiftsPage />;
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

export function TrainingModuleMasterPage() {
  return (
    <MasterCrudPage<TrainingModule>
      title="Training Module Master"
      subtitle="Manage course modules referenced from Job Profiles (Step 6)."
      endpoint="/training-modules"
      columns={[
        { header: 'Code',        render: (row) => <Mono>{row.code}</Mono> },
        { header: 'Name',        render: (row) => <Strong>{row.name}</Strong> },
        { header: 'Description', render: (row) => row.description ?? '—' },
        { header: 'Chapters',    render: (row) => String(row.chapter_count ?? 0).padStart(2, '0') },
        { header: 'Hours',       render: (row) => row.duration_hours != null ? `${row.duration_hours}h` : '—' },
        { header: 'Status',      render: (row) => <StatusPill status={Number(row.is_active) ? 'Active' : 'Inactive'} /> },
      ]}
      buildFields={() => [
        { name: 'code',          label: 'Code',                 type: 'text', placeholder: 'TM001' },
        { name: 'name',          label: 'Name',                 type: 'text', placeholder: 'Workplace Safety', required: true },
        { name: 'description',   label: 'Description',          type: 'textarea', span: true },
        { name: 'chapterCount',  label: 'Chapter Count',        type: 'number', placeholder: '5' },
        { name: 'durationHours', label: 'Duration (hours)',     type: 'number', placeholder: '8' },
        { name: 'coverImageUrl', label: 'Cover Image URL',      type: 'text', placeholder: 'https://…', span: true },
        { name: 'isActive',      label: 'Active',               type: 'checkbox', span: true },
      ]}
      rowToValues={(row) => row ? {
        code: row.code, name: row.name, description: row.description ?? '',
        chapterCount: Number(row.chapter_count) || 0,
        durationHours: row.duration_hours ?? '',
        coverImageUrl: row.cover_image_url ?? '',
        isActive: Boolean(row.is_active),
      } : { code: '', name: '', description: '', chapterCount: 0, durationHours: '', coverImageUrl: '', isActive: true }}
      buildPayload={(values) => ({
        code: values.code || undefined,
        name: values.name,
        description: values.description || undefined,
        chapterCount: Number(values.chapterCount) || 0,
        durationHours: values.durationHours === '' || values.durationHours == null ? undefined : Number(values.durationHours),
        coverImageUrl: values.coverImageUrl || undefined,
        isActive: Boolean(values.isActive),
      })}
      searchKeys={['code', 'name', 'description']}
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

// ─── Lookup Master (generic enum sets used by Vacancy/Listing) ─────────────
type LookupCategory = { id: string; code: string; name: string; description: string | null; is_system: number | boolean };
type LookupValue = {
  id: string; category_id: string; category_code?: string; code: string; label: string;
  color: string | null; sort_order: number | string; is_default: number | boolean; is_active: number | boolean;
};
type LookupTag = { id: string; name: string; color: string | null; description: string | null; is_active: number | boolean };

export function LookupMasterPage() {
  const [cats, setCats] = useState<LookupCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [values, setValues] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<LookupValue | null>(null);
  const [form, setForm] = useState({ code: '', label: '', color: '', sortOrder: 0, isDefault: false, isActive: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: LookupCategory[] }>('/lookup-categories')
      .then((r) => {
        setCats(r.data.data);
        if (r.data.data.length) setActiveCat((cur) => cur || r.data.data[0].code);
      })
      .catch(() => {});
  }, []);

  const fetchValues = (catCode: string) => {
    if (!catCode) return;
    setLoading(true);
    api.get<{ data: LookupValue[] }>('/lookups', { params: { category: catCode } })
      .then((r) => setValues(r.data.data))
      .catch(() => setValues([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (activeCat) fetchValues(activeCat); }, [activeCat]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', label: '', color: '', sortOrder: (values[values.length - 1]?.sort_order ? Number(values[values.length - 1].sort_order) + 10 : 10), isDefault: false, isActive: true });
    setEditOpen(true);
  };
  const openEdit = (row: LookupValue) => {
    setEditing(row);
    setForm({
      code: row.code, label: row.label, color: row.color ?? '',
      sortOrder: Number(row.sort_order), isDefault: Boolean(Number(row.is_default)), isActive: Boolean(Number(row.is_active)),
    });
    setEditOpen(true);
  };
  const save = async () => {
    if (!form.code.trim() || !form.label.trim()) { window.alert('Code and label are required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/lookups/${editing.id}`, form);
      } else {
        await api.post('/lookups', { ...form, categoryCode: activeCat });
      }
      setEditOpen(false);
      fetchValues(activeCat);
    } catch { window.alert('Save failed'); }
    finally { setSaving(false); }
  };
  const remove = async (row: LookupValue) => {
    if (!window.confirm(`Delete "${row.label}"?`)) return;
    try { await api.delete(`/lookups/${row.id}`); fetchValues(activeCat); }
    catch { window.alert('Delete failed'); }
  };

  const cat = cats.find((c) => c.code === activeCat);

  return (
    <div>
      <PageHeader title="Lookup Master" subtitle="Centrally edit enumerated values: listing statuses, applicant sources, interview modes etc." />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {cats.map((c) => (
          <button key={c.id} onClick={() => setActiveCat(c.code)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: activeCat === c.code ? 'var(--ck-ink)' : 'transparent',
              color: activeCat === c.code ? '#fff' : 'var(--ck-ink)',
              border: `1px solid ${activeCat === c.code ? 'var(--ck-ink)' : 'var(--ck-line)'}`,
            }}>
            {c.name}
          </button>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--ck-line)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{cat?.name ?? '—'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>{cat?.description ?? ''}</div>
          </div>
          <Button icon={Plus} variant="primary" onClick={openCreate} disabled={!cat}>Add</Button>
        </div>
        <div className="ck-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['CODE','LABEL','COLOR','SORT','DEFAULT','ACTIVE','ACTIONS'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</td></tr>}
              {!loading && values.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--ck-muted)' }}>No values yet.</td></tr>}
              {values.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                  <td style={{ padding: '10px 16px' }}><Mono>{row.code}</Mono></td>
                  <td style={{ padding: '10px 16px' }}><Strong>{row.label}</Strong></td>
                  <td style={{ padding: '10px 16px' }}>
                    {row.color ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, height: 14, borderRadius: 4, background: row.color, border: '1px solid var(--ck-line)' }} />
                        <Mono>{row.color}</Mono>
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>{Number(row.sort_order)}</td>
                  <td style={{ padding: '10px 16px' }}>{Number(row.is_default) ? '✓' : ''}</td>
                  <td style={{ padding: '10px 16px' }}><StatusPill status={Number(row.is_active) ? 'Active' : 'Inactive'} /></td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(row)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={editing ? 'Edit lookup value' : 'Add lookup value'} width={460}
        footer={<>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </>}>
        <div className="ck-form-grid-2">
          <LF label="Code *"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="In Progress" style={lfInp} /></LF>
          <LF label="Label *"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Display label" style={lfInp} /></LF>
          <LF label="Color (hex)"><input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#888888" style={lfInp} /></LF>
          <LF label="Sort order"><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} style={lfInp} /></LF>
          <LF label="Default" full>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default for new records
            </label>
          </LF>
          <LF label="Active" full>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Visible in pickers
            </label>
          </LF>
        </div>
      </Modal>
    </div>
  );
}

const lfInp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };
function LF({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
    </label>
  );
}

export function TagMasterPage() {
  return (
    <MasterCrudPage<LookupTag>
      title="Tag Master"
      subtitle="Define tags for marking applicants (Hot Lead, Cultural Fit, etc.)."
      endpoint="/tags"
      columns={[
        { header: 'Name', render: (row) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {row.color && <span style={{ width: 12, height: 12, borderRadius: 4, background: row.color, border: '1px solid var(--ck-line)' }} />}
            <Strong>{row.name}</Strong>
          </span>
        )},
        { header: 'Color',       render: (row) => row.color ? <Mono>{row.color}</Mono> : '—' },
        { header: 'Description', render: (row) => row.description ?? '—' },
        { header: 'Status',      render: (row) => <StatusPill status={Number(row.is_active) ? 'Active' : 'Inactive'} /> },
      ]}
      buildFields={() => [
        { name: 'name',        label: 'Name',        type: 'text', required: true, placeholder: 'Hot Lead' },
        { name: 'color',       label: 'Color (hex)', type: 'text', placeholder: '#dc2626' },
        { name: 'description', label: 'Description', type: 'textarea', span: true },
        { name: 'isActive',    label: 'Active',      type: 'checkbox', span: true },
      ]}
      rowToValues={(row) => row
        ? { name: row.name, color: row.color ?? '', description: row.description ?? '', isActive: Boolean(Number(row.is_active)) }
        : { name: '', color: '', description: '', isActive: true }}
      buildPayload={(values) => ({
        name: values.name,
        color: values.color || undefined,
        description: values.description || undefined,
        isActive: Boolean(values.isActive),
      })}
      searchKeys={['name', 'description']}
    />
  );
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
