'use client';

import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';
import TableroAvisoInicio from './TableroAvisoInicio';
import TableroCuerpo from './TableroCuerpo';
import TableroPortalEncabezado from './TableroPortalEncabezado';
import TableroPortalModales from './TableroPortalModales';

const SHELL_CLASS =
  'portal-shell min-h-screen bg-[#0f141c]/70 text-slate-200 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:px-6 md:px-10 font-sans selection:bg-cyan-400 selection:text-slate-950';

export default function TableroPortalLayout(vm: TableroPortalViewModel) {
  return (
    <main className={SHELL_CLASS}>
      <TableroPortalEncabezado vm={vm} />
      <TableroAvisoInicio vm={vm} />
      <TableroCuerpo vm={vm} />
      <TableroPortalModales vm={vm} />
    </main>
  );
}
