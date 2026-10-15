import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PlanesAfipTab from './PlanesAfipTab';
import PrestamosTab from './PrestamosTab';
import SGRTab from './SGRTab';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';

type AfipPrestamosTab = 'afip' | 'prestamos' | 'sgr';

export default function AFIPPrestamosPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as AfipPrestamosTab | null;
  const [tab, setTab] = useState<AfipPrestamosTab>(tabParam ?? 'afip');

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <PageHeader title="AFIP / Créditos" />

      <TabStrip<AfipPrestamosTab>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'afip',      label: 'Planes AFIP' },
          { key: 'prestamos', label: 'Créditos Bancarios' },
          { key: 'sgr',       label: 'SGR' },
        ]}
      />

      {tab === 'afip'      && <PlanesAfipTab />}
      {tab === 'prestamos' && <PrestamosTab />}
      {tab === 'sgr'       && <SGRTab />}
    </div>
  );
}
