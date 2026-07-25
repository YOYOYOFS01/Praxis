"use client";

import { useState } from "react";

export default function PaymentsPage() {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  return (
    <div className="animate-fade-in flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Payments</h1>
        <p className="text-secondary mb-8">Send and receive USDC or tokens securely.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-xl font-semibold">Send Funds</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-secondary mb-2">Recipient Address or ENS</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="0x..." 
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm text-secondary mb-2">Amount (USDC)</label>
              <input 
                type="number" 
                className="glass-input" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            
            <button className="glass-button w-full mt-4 justify-center">
              Review Transaction
            </button>
          </div>
        </div>
        
        <div className="glass-panel p-6 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold">Receive Funds</h2>
          </div>
          <p className="text-sm text-secondary mb-6">Scan QR code to receive payments directly to your connected wallet.</p>
          
          <div className="w-48 h-48 bg-white p-2 rounded-xl flex items-center justify-center mb-6 opacity-90 shadow-lg">
             <div className="w-full h-full border-4 border-black border-dashed flex items-center justify-center">
                <span className="text-black font-bold">QR CODE</span>
             </div>
          </div>
          
          <div className="w-full bg-black/20 p-3 rounded-lg border border-white/10 flex justify-between items-center">
            <span className="text-sm text-secondary truncate mr-2">0x1234...abcd</span>
            <button className="text-primary hover:text-primary-hover transition-colors text-sm font-medium">
               Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
