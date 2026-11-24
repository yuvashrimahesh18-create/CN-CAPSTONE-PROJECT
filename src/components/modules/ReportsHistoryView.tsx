import React, { useState } from 'react';
import { Download, FileText, Printer, Trash2 } from 'lucide-react';
import { useLab } from '../../context/LabContext';

export function ReportsHistoryView() {
  const { reports, updateReportNotes, deleteReport, clearReports } = useLab();
  const [filterModule, setFilterModule] = useState<string>('all');

  const visibleReports = reports.filter((r) => filterModule === 'all' || r.module === filterModule);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netlab-experiment-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const headers = ['ID', 'Timestamp', 'Module', 'Title', 'Topology', 'Status', 'Summary', 'Notes'];
    const rows = reports.map((r) =>
      [r.id, r.timestamp, r.module, r.title, r.topologyName, r.status, r.summary, r.notes]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netlab-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">11. Experiment Reports & Lab History</h2>
          <p className="text-sm text-slate-600 mt-1">
            Persistent audit trail of automated tests, sliding window demonstrations, and fault-injection runs for capstone grading.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
          >
            <option value="all">All Modules ({reports.length})</option>
            <option value="sliding-window">Sliding Window</option>
            <option value="ping-batch">Ping & Batch</option>
            <option value="ip-config">IP Configuration</option>
            <option value="fault-monitoring">Fault Injection</option>
            <option value="mininet-testing">Mininet Verification</option>
          </select>
          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={downloadJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <FileText size={14} /> Export JSON
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 cursor-pointer"
          >
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      {visibleReports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-800">No experiment reports recorded yet</p>
          <p className="text-xs text-slate-500">
            Run a Sliding Window experiment, Batch PingAll, or Capstone Final Verification to generate persistent lab reports.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleReports.map((rep) => (
            <div key={rep.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{rep.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{rep.topologyName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{new Date(rep.timestamp).toLocaleString()}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold uppercase ${
                        rep.status === 'passed'
                          ? 'text-emerald-700'
                          : rep.status === 'warning'
                          ? 'text-amber-700'
                          : 'text-red-700'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => deleteReport(rep.id)}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 self-start cursor-pointer"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>

              <p className="text-sm text-slate-700">{rep.summary}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {Object.entries(rep.metrics).map(([k, v]) => (
                  <div key={k} className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <div className="text-[11px] text-slate-500">{k}</div>
                    <div className="text-xs font-mono font-semibold tabular-nums text-slate-900 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <label className="block text-xs text-slate-500 mb-1">Student / Instructor Lab Notes</label>
                <input
                  type="text"
                  value={rep.notes}
                  onChange={(e) => updateReportNotes(rep.id, e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              onClick={clearReports}
              className="text-xs text-red-600 hover:underline cursor-pointer"
            >
              Clear All History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
