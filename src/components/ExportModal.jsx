import React from 'react';
import { X, FileText, FileDown } from 'lucide-react';
import { exportToDocx } from '../utils/exportDocx';
import { exportToPdf } from '../utils/exportPdf';

export default function ExportModal({ exportData, onClose }) {
  const isLibraryExport = !exportData.route || exportData.route.length === 0;
  const title = isLibraryExport ? 'Export Library' : 'Export Comm Sheet';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-80">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <button onClick={() => { exportToDocx(exportData); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 text-sm font-medium w-full">
            <FileText size={18} />
            Download DOCX
          </button>
          <button onClick={() => { exportToPdf(exportData); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 text-sm font-medium w-full">
            <FileDown size={18} />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
