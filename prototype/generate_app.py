import os
import re

app_js_path = r'C:\Users\Krishna Sharma\Desktop\HackVSIT\praxis-mvp\prototype\app.js'

with open(app_js_path, 'r', encoding='utf-8') as f:
    app_js = f.read()

# We need to rewrite the render functions. 
# Also modify navigate() so it uses the templates object we injected.
# We'll just generate a fresh app.js that maps to the new templates.
# The old one had fake data generators. We can keep some of them or just use the static templates.
# Actually, the user's mockups have hardcoded data. Let's just use the hardcoded templates for now and maybe hook up a few interactions.

new_app_js = """'use strict';

let currentPage = 'login';
let pinBuffer = '';
let pinCallback = null;

document.addEventListener('DOMContentLoaded', () => {
  renderLogin();
});

// ---------- AUTH LOGIC ----------
function renderLogin() {
  document.getElementById('app-shell').style.display = 'none';
  const loginContainer = document.getElementById('login-container');
  loginContainer.style.display = 'flex';
  
  // Wait for templates to load
  if(typeof templates !== 'undefined' && templates.login) {
      // The login template contains the entire main content.
      loginContainer.innerHTML = templates.login;
      
      const loginForm = document.getElementById('loginForm');
      if(loginForm) {
          loginForm.addEventListener('submit', (e) => {
              e.preventDefault();
              const btn = loginForm.querySelector('button[type="submit"]');
              btn.disabled = true;
              btn.innerHTML = `<span class="animate-spin material-symbols-outlined text-[18px]" data-icon="progress_activity">progress_activity</span> Authenticating...`;
              setTimeout(() => {
                  btn.classList.remove('bg-primary');
                  btn.classList.add('bg-success');
                  btn.innerHTML = `<span class="material-symbols-outlined text-[18px]" data-icon="check_circle">check_circle</span> Access Granted`;
                  loginForm.parentElement.classList.add('animate-bounce');
                  setTimeout(() => {
                      loginForm.parentElement.classList.remove('animate-bounce');
                      loginContainer.style.display = 'none';
                      document.getElementById('app-shell').style.display = 'block';
                      navigate('dashboard');
                  }, 400);
              }, 1200);
          });
      }
  }
}

// ---------- NAVIGATION ----------
function navigate(page) {
  currentPage = page;
  
  // Update Sidebar active state
  document.querySelectorAll('aside nav a').forEach(a => {
      a.classList.remove('bg-primary', 'text-on-primary');
      a.classList.add('text-on-surface-variant', 'hover:bg-surface-variant');
  });
  
  // Map page to icon name roughly to find the nav item
  const pageMap = {
      dashboard: 'dashboard',
      wallet: 'account_balance_wallet',
      send: 'payments',
      merchant: 'storefront'
  };
  
  if (pageMap[page]) {
      const activeLink = Array.from(document.querySelectorAll('aside nav a')).find(a => a.innerHTML.includes(pageMap[page]));
      if (activeLink) {
          activeLink.classList.remove('text-on-surface-variant', 'hover:bg-surface-variant');
          activeLink.classList.add('bg-primary', 'text-on-primary');
      }
  }

  const content = document.getElementById('page-content');
  content.style.opacity = 0;
  
  setTimeout(() => {
      if (typeof templates !== 'undefined' && templates[page]) {
          content.innerHTML = templates[page];
          
          // Re-attach event listeners for specific pages if needed
          if (page === 'send') {
              setupSendFlow();
          }
      } else {
          content.innerHTML = `<div class="p-xl text-center"><p class="text-on-surface-variant">Page not available in mockup</p></div>`;
      }
      
      content.style.transition = 'opacity 0.2s';
      content.style.opacity = 1;
  }, 50);
}

// Intercept clicks on links that point to specific screens in the mockup
document.addEventListener('click', (e) => {
    // If it's a link or inside a link
    const link = e.target.closest('a');
    if (link) {
        const href = link.getAttribute('href');
        if (href === '{{DATA:SCREEN:SCREEN_6}}') { e.preventDefault(); navigate('dashboard'); }
        else if (href === '{{DATA:SCREEN:SCREEN_5}}') { e.preventDefault(); navigate('wallet'); }
        else if (href === '{{DATA:SCREEN:SCREEN_4}}') { e.preventDefault(); navigate('send'); }
        else if (href === '{{DATA:SCREEN:SCREEN_2}}') { e.preventDefault(); navigate('merchant'); }
    }
});

// ---------- PIN MODAL ----------
function showPinModal(callback) {
  pinBuffer = '';
  pinCallback = callback;
  updatePinDots();
  document.getElementById('pin-error').classList.add('hidden');
  document.getElementById('lock-icon').classList.remove('bg-success-s', 'text-success');
  document.getElementById('lock-icon').classList.add('bg-surface-container-high', 'text-on-surface-variant');
  document.getElementById('pin-overlay').classList.remove('hidden');
}
function closePinModal() {
  document.getElementById('pin-overlay').classList.add('hidden');
  pinBuffer = '';
  pinCallback = null;
}
function pinInput(digit) {
  if (pinBuffer.length >= 6) return;
  pinBuffer += digit;
  updatePinDots();
  if (pinBuffer.length === 6) setTimeout(verifyPin, 200);
}
function pinBackspace() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
}
function updatePinDots() {
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById('d' + i);
    if (i < pinBuffer.length) {
        dot.classList.add('bg-on-surface', 'border-on-surface');
        dot.classList.remove('border-outline-variant');
    } else {
        dot.classList.remove('bg-on-surface', 'border-on-surface', 'border-error', 'bg-error');
        dot.classList.add('border-outline-variant');
    }
  }
}
function verifyPin() {
  if (pinBuffer === '123456') {
    document.getElementById('lock-icon').classList.remove('bg-surface-container-high', 'text-on-surface-variant');
    document.getElementById('lock-icon').classList.add('bg-success', 'text-on-success');
    document.getElementById('lock-icon').innerHTML = '<span class="material-symbols-outlined text-[24px]">check</span>';
    setTimeout(() => {
      closePinModal();
      if (pinCallback) pinCallback(true);
    }, 600);
  } else {
    document.getElementById('pin-error').classList.remove('hidden');
    for (let i = 0; i < 6; i++) {
      const dot = document.getElementById('d' + i);
      dot.classList.add('bg-error', 'border-error');
      dot.classList.remove('bg-on-surface', 'border-on-surface');
    }
    const box = document.querySelector('.pin-modal');
    if(box) {
        box.classList.add('shake');
        setTimeout(() => box.classList.remove('shake'), 400);
    }
    setTimeout(() => {
      pinBuffer = '';
      updatePinDots();
      document.getElementById('pin-error').classList.add('hidden');
    }, 800);
  }
}

// ---------- SEND FLOW LOGIC (Mock) ----------
function setupSendFlow() {
    // If the send flow button exists, attach PIN modal
    const sendBtn = document.querySelector('button:contains("Submit Payment")') || document.querySelector('button.bg-primary');
    if (sendBtn) {
        // Just a basic mock for now
        sendBtn.addEventListener('click', (e) => {
            if(sendBtn.textContent.includes('Send') || sendBtn.textContent.includes('Submit') || sendBtn.textContent.includes('Confirm')) {
                e.preventDefault();
                showPinModal((success) => {
                    if (success) {
                        showToast('Payment sent successfully!', 'success');
                        setTimeout(() => navigate('history'), 1000);
                    }
                });
            }
        });
    }
}

// ---------- TOAST ----------
function showToast(message, type = 'info', duration = 3500) {
  const icons = {
    success: `<span class="material-symbols-outlined text-success">check_circle</span>`,
    error:   `<span class="material-symbols-outlined text-error">error</span>`,
    warning: `<span class="material-symbols-outlined text-warning">warning</span>`,
    info:    `<span class="material-symbols-outlined text-pending">info</span>`,
  };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${icons[type]||icons.info}<span>${message}</span><button class="ml-auto text-outline hover:text-on-surface p-1" onclick="this.parentElement.remove()">✕</button>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 250); }, duration);
}
"""

with open(app_js_path, 'w', encoding='utf-8') as f:
    f.write(new_app_js)
