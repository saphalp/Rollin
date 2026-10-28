"""Generate Supabase SQL to fill Roli's optional US university picker.
Run on your own computer: py roli_import_us_universities.py
Source: Hipo university-domains-list (MIT license), updated by community.
This is only an optional selection catalog, NOT proof of email verification.
"""
import json
from pathlib import Path
from urllib.request import Request, urlopen

URL = 'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json'
req = Request(URL, headers={'User-Agent': 'Roli-UniversityDirectory/1.0'})
with urlopen(req, timeout=45) as response:
    data = json.load(response)

names = sorted({
    str(item['name']).strip()
    for item in data
    if item.get('alpha_two_code') == 'US' and item.get('name') and str(item['name']).strip()
}, key=str.casefold)

if not names:
    raise RuntimeError('No US universities found: import aborted.')

out = Path(__file__).with_name('roli_us_universities_seed.sql')
with out.open('w', encoding='utf-8') as handle:
    handle.write('-- Generated from Hipo university-domains-list; review before running.\n')
    for start in range(0, len(names), 250):
        chunk = names[start:start + 250]
        values = ',\n'.join("('%s', 'US')" % name.replace("'", "''") for name in chunk)
        handle.write('insert into public.university_directory (name, country_code) values\n')
        handle.write(values)
        handle.write('\non conflict (name) do nothing;\n\n')
print(f'Created {out} with {len(names)} US institutions.')
