import os
import re

base_dir = r'C:\Users\Krishna Sharma\Desktop\HackVSIT\praxis-mvp\prototype\demo_ui\stitch_mock_ui_prototype'
dashboard_path = os.path.join(base_dir, 'dashboard/code.html')

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the <head> and the header/aside layout
head_match = re.search(r'<head>(.*?)</head>', content, re.DOTALL)
header_match = re.search(r'<header[^>]*>.*?</header>', content, re.DOTALL)
aside_match = re.search(r'<aside[^>]*>.*?</aside>', content, re.DOTALL)
config_match = re.search(r'<script id="tailwind-config">.*?</script>', content, re.DOTALL)

index_html_content = f"""<!DOCTYPE html>
<html lang="en" class="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Praxis — Financial Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  {config_match.group(0)}
  <style>
    /* Pin Modal specific CSS */
    .material-symbols-outlined {{ font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; vertical-align: middle; }}
    .auth-card {{ box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05); }}
    .form-input {{ transition: border-width 0.1s ease-in-out, ring 0.1s ease-in-out; }}
    .btn-interact:active {{ transform: scale(0.98); }}
    
    .toast-container {{ position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 8px; z-index: 200; pointer-events: none; }}
    .toast {{ display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 8px; border: 1px solid #c4c7c7; background: #ffffff; box-shadow: 0 4px 16px rgba(26,28,27,0.08); font-size: 14px; font-weight: 500; color: #1a1c1b; min-width: 280px; max-width: 380px; pointer-events: all; animation: toast-in 0.25s cubic-bezier(0.4,0,0.2,1); }}
    @keyframes toast-in  {{ from {{ transform: translateX(110%); opacity: 0; }} to {{ transform: translateX(0); opacity: 1; }} }}
    @keyframes toast-out {{ from {{ transform: translateX(0); opacity: 1; }} to {{ transform: translateX(110%); opacity: 0; }} }}
    .toast.leaving {{ animation: toast-out 0.2s forwards; }}
    #app-shell {{ display: none; }} /* Hidden by default until login */
  </style>
</head>
<body class="bg-background text-on-background font-body text-body selection:bg-primary-fixed selection:text-primary min-h-screen">

<div id="toast-container" class="toast-container"></div>

<!-- LOGIN PAGE CONTAINER -->
<div id="login-container" class="w-full min-h-screen flex flex-col items-center justify-center">
</div>

<!-- MAIN APP SHELL -->
<div id="app-shell" class="hidden">
  {header_match.group(0)}
  <div class="flex min-h-screen">
    {aside_match.group(0)}
    <main class="flex-1 md:ml-sidebar-expanded p-lg lg:p-xl flex flex-col gap-xl" id="page-content">
      <!-- Injected by JS -->
    </main>
  </div>
</div>

<!-- PIN MODAL -->
<div id="pin-overlay" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] hidden">
  <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg w-[340px] shadow-2xl flex flex-col items-center animate-[modal-in_0.18s_ease-out]">
    <div class="text-center mb-lg w-full">
      <div id="lock-icon" class="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mx-auto mb-md transition-colors">
        <span class="material-symbols-outlined text-[24px]">lock</span>
      </div>
      <h3 class="font-bold text-[17px] text-on-surface mb-xs">Wallet Authentication</h3>
      <p class="text-[13px] text-on-surface-variant">Enter your 6-digit PIN to continue</p>
    </div>
    <div id="pin-dots" class="flex gap-md mb-md">
      <div class="w-3 h-3 rounded-full border-2 border-outline-variant" id="d0"></div>
      <div class="w-3 h-3 rounded-full border-2 border-outline-variant" id="d1"></div>
      <div class="w-3 h-3 rounded-full border-2 border-outline-variant" id="d2"></div>
      <div class="w-3 h-3 rounded-full border-2 border-outline-variant" id="d3"></div>
      <div class="w-3 h-3 rounded-full border-2 border-outline-variant" id="d4"></div>
      <div class="w-3 h-3 rounded-full border-2 border-outline-variant" id="d5"></div>
    </div>
    <div id="pin-error" class="text-[12px] text-error text-center mb-sm hidden">Incorrect PIN. 2 attempts remaining.</div>
    <div class="grid grid-cols-3 gap-sm w-full">
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('1')">1</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('2')">2</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('3')">3</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('4')">4</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('5')">5</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('6')">6</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('7')">7</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('8')">8</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('9')">9</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[13px] font-medium text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all" onclick="closePinModal()">Cancel</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[18px] font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all" onclick="pinInput('0')">0</button>
      <button class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-[13px] font-medium text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all" onclick="pinBackspace()">⌫</button>
    </div>
  </div>
</div>

<script src="extracted_templates.js"></script>
<script src="app.js"></script>
</body>
</html>
"""

with open(r'C:\Users\Krishna Sharma\Desktop\HackVSIT\praxis-mvp\prototype\index.html', 'w', encoding='utf-8') as f:
    f.write(index_html_content)
