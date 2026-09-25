'use client';

import { useTableroPortal } from '../../hooks/useTableroPortal';
import TableroPortalLayout from './TableroPortalLayout';

export default function TableroPortal() {
  const vm = useTableroPortal();

  if (!vm.ui.iniciado) {
    return (
      <main className="min-h-screen bg-[#0f141c] text-slate-200 flex items-center justify-center">
        <div className="text-center font-medium text-slate-400">
          <span className="text-3xl animate-spin block mb-2">⌛</span>
          Iniciando portal UGR...
        </div>
      </main>
    );
  }

  return <TableroPortalLayout {...vm} />;
}
