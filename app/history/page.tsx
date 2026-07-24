"use client";

export default function HistoryPage() {
  return (
    <div className="animate-fade-in flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Run History</h1>
          <p className="text-secondary">View all past autonomous agent executions and transactions.</p>
        </div>
        <div className="flex gap-2">
           <input type="text" className="glass-input text-sm py-2 px-3 w-64" placeholder="Search prompts or hashes..." />
        </div>
      </div>
      
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-black/20 text-secondary text-sm">
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Prompt</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium text-right">Proof Hash</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
              <td className="p-4"><span className="status-badge status-success">Success</span></td>
              <td className="p-4 truncate max-w-xs text-sm">Order 2 Dell XPS 15 from TechVendor Inc</td>
              <td className="p-4 font-semibold text-sm">3,400.00 USDC</td>
              <td className="p-4 text-sm text-secondary">2 hours ago</td>
              <td className="p-4 text-right font-mono text-xs text-secondary hover:text-white flex items-center justify-end gap-1">
                0xabc1...9f8e <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
              </td>
            </tr>
            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
              <td className="p-4"><span className="status-badge status-failed">Failed</span></td>
              <td className="p-4 truncate max-w-xs text-sm">Purchase 500 gaming chairs</td>
              <td className="p-4 font-semibold text-sm">125,000.00 USDC</td>
              <td className="p-4 text-sm text-secondary">Yesterday</td>
              <td className="p-4 text-right font-mono text-xs text-secondary hover:text-white flex items-center justify-end gap-1">
                0x7f2...a1b2 <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
              </td>
            </tr>
            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
              <td className="p-4"><span className="status-badge status-pending">Pending</span></td>
              <td className="p-4 truncate max-w-xs text-sm">Subscribe to AI services API</td>
              <td className="p-4 font-semibold text-sm">99.00 USDC</td>
              <td className="p-4 text-sm text-secondary">Oct 20, 2026</td>
              <td className="p-4 text-right font-mono text-xs text-secondary hover:text-white flex items-center justify-end gap-1">
                0x3cd...44ab <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
