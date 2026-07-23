import os
import re
import json

base_dir = r'C:\Users\Krishna Sharma\Desktop\HackVSIT\praxis-mvp\prototype\demo_ui\stitch_mock_ui_prototype'
pages = {
    'dashboard': 'dashboard/code.html',
    'wallet': 'wallet_overview/code.html',
    'send': 'send_payment/code.html',
    'merchant': 'merchant_dashboard/code.html',
    'login': 'login_to_praxis/code.html'
}

html_strings = {}

for page, path in pages.items():
    full_path = os.path.join(base_dir, path)
    if os.path.exists(full_path):
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Extract main content
            match = re.search(r'<main[^>]*>(.*?)</main>', content, re.DOTALL)
            if match:
                html_strings[page] = match.group(1).strip()
            else:
                html_strings[page] = '<!-- Main not found -->'

# write the strings out to a js file so we can just copy-paste or inject them
with open(r'C:\Users\Krishna Sharma\Desktop\HackVSIT\praxis-mvp\prototype\extracted_templates.js', 'w', encoding='utf-8') as f:
    f.write('const templates = ')
    # Dump it as JSON so it's a valid JS object with proper escaping
    f.write(json.dumps(html_strings, indent=2))
    f.write(';\n')
