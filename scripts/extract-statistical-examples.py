"""Rebuild the small licensed extracts from admitted local originals; no network access.
Usage: python3 scripts/extract-statistical-examples.py BIOMASS.xlsx CO2.csv
"""
import csv, hashlib, io, json, sys, zipfile
import xml.etree.ElementTree as E
from pathlib import Path
bio_path, physical_path = map(Path, sys.argv[1:3])
expected_bio = '98833cf34fda5b598ed0dbb390386abf1797e26b5e9393f5df8a1266c2ff5e68'
expected_physical = 'd895fb5b4a59fb5e4cd98e69b7667fe5bef595c6581f630852b12cb41c07f675'
for path, expected in [(bio_path, expected_bio), (physical_path, expected_physical)]:
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f'{path.name}: source digest changed; readmit before updating the example.')
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(bio_path) as archive:
    workbook = E.fromstring(archive.read('xl/workbook.xml'))
    relationships = {e.attrib['Id']: e.attrib['Target'] for e in E.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
    sheet = next(e for e in workbook.find('s:sheets', ns) if e.attrib['name'] == 'Summary')
    target = relationships[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
    target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
    cells = {e.attrib['r']: e.find('s:v', ns).text for e in E.fromstring(archive.read(target)).findall('.//s:c', ns) if e.find('s:v', ns) is not None}
    bio = [{'rank': r-4, 'colMean': cells[f'B{r}'], 'colSE': cells[f'C{r}'], 'mirMean': cells[f'D{r}'], 'mirSE': cells[f'E{r}'], 'contributors': 5} for r in range(5, 15)]
raw_csv = physical_path.read_text()
if '# Monthly mean CO2 constructed from daily mean values.' not in raw_csv:
    raise ValueError('Admitted NOAA source quote changed.')
reader = csv.DictReader(io.StringIO('\n'.join(line for line in raw_csv.splitlines() if not line.startswith('#'))))
physical = [{key: value.strip() for key, value in row.items()} for row in reader if row['year'].strip() == '2020']
if len(bio) != 10 or len(physical) != 12:
    raise ValueError('Admitted source slice has unexpected row counts.')
# Preserve the original decimal strings. App conversion to IEEE-754 values is explicit.
result = {'schemaVersion': 1, 'checkedAt': '2026-10-28', 'biology': {'sourceSha256': expected_bio, 'sourceQuote': 'Biomass and area of Col-0 and 35S:miR156 Arabidopsis rosette and leaves', 'sourceUrl': 'https://fairdomhub.org/data_files/2212?version=1', 'edition': 'Version 1, 22 August 2018; Summary!A5:E14; day 37 after sowing', 'license': 'CC0-1.0 for data; CC-BY-4.0 for site metadata', 'rows': bio}, 'physics': {'sourceSha256': expected_physical, 'sourceQuote': 'Monthly mean CO2 constructed from daily mean values.', 'sourceUrl': 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv', 'edition': 'File Creation: Fri Oct 9 13:08:07 2026; year=2020 rows', 'license': 'NOAA GML public-domain reuse terms; attribution retained, no endorsement', 'rows': physical}}
Path('data/statistical-examples.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
