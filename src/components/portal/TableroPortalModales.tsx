'use client';

import { buildPortalModalesProps } from '../../lib/tablero-portal-view-props';
import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';
import PortalModales from './PortalModales';

export default function TableroPortalModales({ vm }: { vm: TableroPortalViewModel }) {
  return <PortalModales {...buildPortalModalesProps(vm)} />;
}
