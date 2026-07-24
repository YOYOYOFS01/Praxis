"use client";

import { useState } from "react";

export default function MerchantPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="animate-fade-in flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Merchant Storefront</h1>
          <p className="text-secondary">Generate and manage crypto payment invoices.</p>
        </div>
        <button className="glass-button" onClick={() => setShowModal(true)}>
          <span className="material-symbols-outlined">add</span> Create Invoice
        </button>
      </div>
      
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-black/20 text-secondary text-sm">
              <th className="p-4 font-medium">Invoice ID</th>
              <th className="p-4 font-medium">Description</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="p-4 font-mono text-sm">#INV-001</td>
              <td className="p-4">Annual SaaS Subscription</td>
              <td className="p-4 font-semibold">1,200.00 USDC</td>
              <td className="p-4"><span className="status-badge status-success">Paid</span></td>
              <td className="p-4 text-sm text-secondary">Oct 24, 2026</td>
              <td className="p-4 text-right">
                <button className="text-secondary hover:text-white transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>download</span>
                </button>
              </td>
            </tr>
            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="p-4 font-mono text-sm">#INV-002</td>
              <td className="p-4">Custom API Integration</td>
              <td className="p-4 font-semibold">5,000.00 USDC</td>
              <td className="p-4"><span className="status-badge status-pending">Pending</span></td>
              <td className="p-4 text-sm text-secondary">Oct 25, 2026</td>
              <td className="p-4 text-right flex justify-end gap-2">
                <button className="text-secondary hover:text-white transition-colors" title="Copy Link">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>link</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel p-8 w-full max-w-md animate-slide-up">
            <h2 className="text-2xl font-bold mb-6">New Invoice</h2>
            <div className="flex flex-col gap-4 mb-8">
              <div>
                <label className="block text-sm text-secondary mb-2">Description</label>
                <input type="text" className="glass-input" placeholder="e.g. Consulting Services" />
              </div>
              <div>
                <label className="block text-sm text-secondary mb-2">Amount (USDC)</label>
                <input type="number" className="glass-input" placeholder="0.00" />
              </div>
            </div>
            <div className="flex justify-end gap-4">
              <button className="px-4 py-2 text-secondary hover:text-white transition-colors" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="glass-button" onClick={() => setShowModal(false)}>Generate Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
