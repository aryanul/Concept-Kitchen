import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';

type Props = { title: string; phase: string };

export function StubPage({ title, phase }: Props) {
  return (
    <div>
      <PageHeader title={title} subtitle={`Part of ${phase}.`} />
      <Card padding={48} style={{ textAlign: 'center' }}>
        <Construction
          size={48}
          strokeWidth={1.4}
          style={{ color: 'var(--ck-muted)', marginBottom: 12 }}
        />
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 8 }}>
          Coming soon
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--ck-muted)' }}>
          This module is part of {phase}. We'll build it step-by-step after the foundation lands.
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--ck-accent)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </Card>
    </div>
  );
}
