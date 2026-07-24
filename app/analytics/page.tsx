"use client";

export default function AnalyticsPage() {
  return (
    <div className="animate-fade-in flex flex-col gap-6 w-full max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Analytics</h1>
        <p className="text-secondary">Platform usage, volume, and agent performance metrics.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel p-6 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-secondary text-sm font-medium uppercase tracking-wider">Total Volume</span>
            <span className="material-symbols-outlined text-primary">payments</span>
          </div>
          <div className="text-4xl font-bold mt-2">$2.4M</div>
          <div className="text-success text-sm flex items-center gap-1 mt-1">
             <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>trending_up</span> +14.5% from last month
          </div>
        </div>
        
        <div className="glass-panel p-6 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-secondary text-sm font-medium uppercase tracking-wider">Active Runs</span>
            <span className="material-symbols-outlined text-accent">robot_2</span>
          </div>
          <div className="text-4xl font-bold mt-2">1,204</div>
          <div className="text-success text-sm flex items-center gap-1 mt-1">
             <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>trending_up</span> +5.2% from last month
          </div>
        </div>
        
        <div className="glass-panel p-6 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-secondary text-sm font-medium uppercase tracking-wider">Rejection Rate</span>
            <span className="material-symbols-outlined text-danger">gpp_bad</span>
          </div>
          <div className="text-4xl font-bold mt-2">3.8%</div>
          <div className="text-danger text-sm flex items-center gap-1 mt-1">
             <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>trending_down</span> Guardrail blocks increased
          </div>
        </div>
      </div>
      
      <div className="glass-panel p-6 h-96 flex flex-col">
         <h2 className="text-lg font-semibold mb-6">Transaction Volume (30 Days)</h2>
         <div className="flex-1 border-b border-l border-white/10 flex items-end justify-between pt-8 pb-0 px-2 gap-2">
            {/* CSS Mock Chart */}
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 100, 75, 95].map((height, i) => (
              <div key={i} className="w-full bg-primary/40 hover:bg-primary transition-all rounded-t-sm relative group" style={{ height: `${height}%` }}>
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    ${Math.floor(height * 1.2)}k
                 </div>
              </div>
            ))}
         </div>
         <div className="flex justify-between text-xs text-secondary mt-3 px-2">
            <span>Oct 1</span>
            <span>Oct 15</span>
            <span>Oct 30</span>
         </div>
      </div>
    </div>
  );
}
