'use client';

import dynamic from 'next/dynamic';
import { buildPortalModalesProps } from '../../lib/tablero-portal-view-props';
import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';

const PortalModales = dynamic(() => import('./PortalModales'), { ssr: false });

export default function TableroPortalModales({ vm }: { vm: TableroPortalViewModel }) {
  return <PortalModales {...buildPortalModalesProps(vm)} />;
}
