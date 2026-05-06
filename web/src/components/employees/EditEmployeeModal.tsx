import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

type Employee = {
  id: string; first_name: string; last_name: string; designation: string; status: string; phone: string;
  branch_id: string; department_id: string; grade_id: string;
  bank_name: string | null; bank_account: string | null; ifsc: string | null;
  pan: string | null; aadhaar: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  onUpdated: () => void;
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  grades: { id: string; code: string; kind: string }[];
};

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  designation: z.string().min(1, 'Required'),
  status: z.string().min(1, 'Required'),
  phone: z.string().min(6, 'Required'),
  branchId: z.string().min(1, 'Select a branch'),
  departmentId: z.string().min(1, 'Select a department'),
  gradeId: z.string().min(1, 'Select a grade'),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  pan: z.string().optional(),
  aadhaar: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditEmployeeModal({ open, onClose, employee, onUpdated, branches, departments, grades }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!employee) return;
    reset({
      firstName: employee.first_name,
      lastName: employee.last_name,
      designation: employee.designation,
      status: employee.status,
      phone: employee.phone,
      branchId: employee.branch_id,
      departmentId: employee.department_id,
      gradeId: employee.grade_id,
      bankName: employee.bank_name ?? '',
      bankAccount: employee.bank_account ?? '',
      ifsc: employee.ifsc ?? '',
      pan: employee.pan ?? '',
      aadhaar: employee.aadhaar ?? '',
    });
  }, [employee, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!employee) return;
    try {
      await api.patch(`/employees/${employee.id}`, {
        first_name: data.firstName,
        last_name: data.lastName,
        designation: data.designation,
        status: data.status,
        phone: data.phone,
        branch_id: data.branchId,
        department_id: data.departmentId,
        grade_id: data.gradeId,
        bank_name: data.bankName || null,
        bank_account: data.bankAccount || null,
        ifsc: data.ifsc || null,
        pan: data.pan || null,
        aadhaar: data.aadhaar || null,
      });
      toast.success('Employee updated');
      onClose();
      onUpdated();
    } catch { toast.error('Failed to update employee'); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Employee" width={600}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="edit-employee-form" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button>
      </>}
    >
      <form id="edit-employee-form" onSubmit={handleSubmit(onSubmit)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="First name *" error={errors.firstName?.message}><input {...register('firstName')} style={inp} /></F>
          <F label="Last name *" error={errors.lastName?.message}><input {...register('lastName')} style={inp} /></F>
          <F label="Designation *" error={errors.designation?.message} full><input {...register('designation')} style={inp} /></F>
          <F label="Status *" error={errors.status?.message}>
            <select {...register('status')} style={inp}>
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="EXITED">Exited</option>
            </select>
          </F>
          <F label="Phone *" error={errors.phone?.message}><input {...register('phone')} style={inp} /></F>
          <F label="Branch *" error={errors.branchId?.message}>
            <select {...register('branchId')} style={inp}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </F>
          <F label="Department *" error={errors.departmentId?.message}>
            <select {...register('departmentId')} style={inp}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </F>
          <F label="Grade *" error={errors.gradeId?.message}>
            <select {...register('gradeId')} style={inp}>
              <option value="">Select grade</option>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.kind}</option>)}
            </select>
          </F>
        </div>
        <div style={{ borderTop: '1px solid var(--ck-line)', margin: '18px 0 14px', paddingTop: 14, fontSize: 12, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bank & Statutory (optional)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="Bank name"><input {...register('bankName')} style={inp} /></F>
          <F label="Account number"><input {...register('bankAccount')} style={inp} /></F>
          <F label="IFSC"><input {...register('ifsc')} style={inp} /></F>
          <F label="PAN"><input {...register('pan')} style={inp} /></F>
          <F label="Aadhaar"><input {...register('aadhaar')} style={inp} /></F>
        </div>
      </form>
    </Modal>
  );
}

const inp: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)',
  borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)', color: 'var(--ck-ink)',
};

function F({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11.5, color: 'var(--ck-danger-fg)' }}>{error}</span>}
    </label>
  );
}
