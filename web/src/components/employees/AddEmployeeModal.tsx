import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

const schema = z.object({
  firstName:    z.string().min(1, 'Required'),
  lastName:     z.string().min(1, 'Required'),
  email:        z.string().email('Valid email required'),
  phone:        z.string().min(10, 'Valid phone required'),
  designation:  z.string().min(1, 'Required'),
  branchId:     z.string().min(1, 'Select a branch'),
  departmentId: z.string().min(1, 'Select a department'),
  gradeId:      z.string().min(1, 'Select a grade'),
  joiningDate:  z.string().min(1, 'Required'),
  ctcRupees:    z.coerce.number().positive('Must be positive'),
  bankName:     z.string().optional(),
  bankAccount:  z.string().optional(),
  ifsc:         z.string().optional(),
  pan:          z.string().optional(),
  aadhaar:      z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  grades: { id: string; code: string; kind: string }[];
};

export function AddEmployeeModal({ open, onClose, onCreated, branches, departments, grades }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ctcRupees: 0 },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post('/employees', data);
      toast.success('Employee added successfully');
      reset();
      onClose();
      onCreated();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to add employee';
      toast.error(msg);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add Employee" subtitle="New employee will be set to Active status." width={600}
      footer={<>
        <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button variant="primary" type="submit" form="add-employee-form" disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add Employee'}
        </Button>
      </>}>
      <form id="add-employee-form" onSubmit={handleSubmit(onSubmit)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="First name *" error={errors.firstName?.message}><input {...register('firstName')} style={inp} /></F>
          <F label="Last name *"  error={errors.lastName?.message}><input {...register('lastName')}  style={inp} /></F>
          <F label="Email *"      error={errors.email?.message}><input type="email" {...register('email')} style={inp} /></F>
          <F label="Phone *"      error={errors.phone?.message}><input {...register('phone')} placeholder="+919XXXXXXXXX" style={inp} /></F>
          <F label="Designation *" error={errors.designation?.message} full><input {...register('designation')} style={inp} /></F>
          <F label="Branch *"      error={errors.branchId?.message}>
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
          <F label="Joining date *" error={errors.joiningDate?.message}><input type="date" {...register('joiningDate')} style={inp} /></F>
          <F label="Annual CTC (₹) *" error={errors.ctcRupees?.message}><input type="number" {...register('ctcRupees')} placeholder="600000" style={inp} /></F>
        </div>
        <div style={{ borderTop: '1px solid var(--ck-line)', margin: '18px 0 14px', paddingTop: 14, fontSize: 12, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bank &amp; Statutory (optional)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="Bank name"><input {...register('bankName')} style={inp} /></F>
          <F label="Account number"><input {...register('bankAccount')} style={inp} /></F>
          <F label="IFSC"><input {...register('ifsc')} style={inp} /></F>
          <F label="PAN"><input {...register('pan')} placeholder="ABCDE1234F" style={inp} /></F>
          <F label="Aadhaar"><input {...register('aadhaar')} placeholder="XXXXXXXXXXXX" style={inp} /></F>
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
