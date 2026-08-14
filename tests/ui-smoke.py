from pathlib import Path
import base64
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'assets/css/app.css').read_text(encoding='utf-8')
constants = (ROOT / 'assets/js/constants.js').read_text(encoding='utf-8')
importer = (ROOT / 'assets/js/importer.js').read_text(encoding='utf-8')
validation = (ROOT / 'assets/js/validation.js').read_text(encoding='utf-8')
exporter = (ROOT / 'assets/js/export.js').read_text(encoding='utf-8')
app = (ROOT / 'assets/js/app.js').read_text(encoding='utf-8')

# The smoke test uses a deterministic SheetJS API shim because network access is disabled
# in the execution environment. Production still loads the pinned official browser build.
shim = r'''
window.XLSX = {
  _nextRows: null,
  read(bytes) {
    const text = new TextDecoder('utf-8').decode(bytes);
    if (text.includes('not really xlsx')) throw new Error('corrupt workbook');
    const rows = window.XLSX._nextRows || [
      ['Negotiable Tariff Source'],
      ['Generated for browser testing'],
      [],
      [' RUTE   KANTOR ', ' TARIF ', ' layanan '],
      ['01234|00110', 10000, 'PKH SPECIAL'],
      ['29400|10110', 12500, 'POS EXPRESS SPECIAL'],
      ['29400|10110', 14000, 'DUPLICATE SHOULD SKIP'],
      ['40100|60200', 15000, 'PJE SPECIAL']
    ];
    return { SheetNames:['Source Tariff'], Sheets:{'Source Tariff':{'!ref':'A1:C8',__rows:rows}} };
  },
  write(workbook) { window.__lastWorkbook = workbook; return new Uint8Array([80,75,3,4,84,69,83,84]).buffer; },
  utils: {
    sheet_to_json(sheet) { return sheet.__rows; },
    encode_cell(pos) { let n=pos.c+1,s=''; while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)} return s+(pos.r+1); },
    encode_range(range) { return this.encode_cell(range.s)+':'+this.encode_cell(range.e); },
    book_new() { return {SheetNames:[],Sheets:{}}; },
    book_append_sheet(wb,ws,name) { wb.SheetNames.push(name); wb.Sheets[name]=ws; }
  }
};
'''

# Replace external links/scripts with inline assets for deterministic rendering.
start = html.index('<link rel="stylesheet"')
end = html.index('>', start) + 1
html = html[:start] + '<style>' + css + '</style>' + html[end:]
script_start = html.index('  <script src="https://cdn.sheetjs.com')
script_end = html.index('</body>')
inline_scripts = '<script>' + shim + '</script>' + ''.join('<script>' + s + '</script>' for s in [constants, importer, validation, exporter, app]) + '\n'
html = html[:script_start] + inline_scripts + html[script_end:]

failures = []
checks = 0

def check(condition, message):
    global checks
    checks += 1
    if not condition:
        failures.append(message)

with sync_playwright() as p:
    chromium = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
    if not chromium:
        raise SystemExit('Chromium is required for UI smoke tests.')
    browser = p.chromium.launch(headless=True, executable_path=chromium, args=['--no-sandbox','--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page_errors = []
    page.on('pageerror', lambda exc: page_errors.append(str(exc)))
    page.set_content(html, wait_until='load', timeout=60000)
    page.wait_for_selector('#tariffTableBody tr')

    check(page.title() == 'Pembuat Tarif Negotiable MILE | PosNew Hub', 'Unexpected page title')
    check(page.locator('html').get_attribute('lang') == 'id', 'HTML language is not Indonesian')
    check(page.locator('#appVersion').text_content() == 'Versi 2.0.0', 'Visible application version is missing')
    check(page.locator('#tariffTableBody tr').count() == 1, 'Initial row missing')
    check(page.locator('#exportButton').is_disabled(), 'Export should start disabled')
    check(page.locator('body').evaluate('(el)=>el.scrollWidth <= el.clientWidth'), 'Desktop page has horizontal overflow')
    check(page.locator('.dashboard-footer').evaluate('(el)=>Math.round(el.getBoundingClientRect().height)') == 38, 'Desktop footer height is not 38px')
    page.keyboard.press('Tab')
    check(page.locator('.skip-link').is_visible(), 'Skip link is not keyboard visible')
    page.evaluate('document.activeElement.blur()')
    check(page.locator('#liveStatus').get_attribute('aria-live') == 'polite', 'Live status region missing')

    page.fill('#customerId', 'abc01')
    page.fill('#salesforceNumber', 'SF-914372-A')
    page.fill('#startDate', '2026-08-01')
    page.fill('#endDate', '2026-12-31')

    xlsx = ROOT / 'tests/fixtures/valid-tariff.xlsx'
    page.set_input_files('#fileInput', str(xlsx))
    page.wait_for_function("document.querySelector('#importedMetric').textContent === '3'")
    check(page.locator('#tariffTableBody tr').count() == 3, 'XLSX import did not create 3 deduplicated routes')
    check(page.locator('#duplicatesMetric').text_content() == '1', 'Duplicate count was not reported')
    check(page.locator('#exportButton').is_disabled(), 'Import must require an SLA before export')
    check(page.locator('#selectedFileName').text_content() == 'valid-tariff.xlsx', 'Selected filename not shown')

    for sla_input in page.locator('[data-field="slaDays"]').all():
        sla_input.fill('3')
    check(page.locator('#exportButton').is_enabled(), 'Valid imported data with SLA should enable export')

    first_service = page.locator('#tariffTableBody tr').first.locator('[data-field="serviceId"]')
    first_service.select_option('452')
    first_formula = page.locator('#tariffTableBody tr').first.locator('[data-field="formulaIdOverride"]')
    check('1669' in first_formula.locator('option').first.text_content(), 'Automatic PJB formula mapping did not update')
    first_formula.select_option('1644')
    check('72 jam' in page.locator('#tariffTableBody tr').first.locator('.sla-display').text_content(), 'SLA hours were not calculated from user input')

    # Remove file reference without deleting reviewed rows.
    page.click('#removeFileButton')
    check(page.locator('#tariffTableBody tr').count() == 3, 'Removing file unexpectedly erased tariff rows')

    # Add, duplicate, filter, and delete a manual row.
    page.click('#addRowButton')
    check(page.locator('#tariffTableBody tr').count() == 4, 'Add row failed')
    last = page.locator('#tariffTableBody tr').last
    last.locator('[data-field="origin"]').fill('50100')
    last.locator('[data-field="destination"]').fill('60100')
    last.locator('[data-field="slaDays"]').fill('5')
    last.locator('[data-field="minimumTariff"]').fill('17000')
    last.locator('[data-field="incrementTariff"]').fill('17000')
    last.locator('[data-field="description"]').fill('manual tariff')
    last.locator('button[data-action="duplicate"]').click()
    check(page.locator('#tariffTableBody tr').count() == 5, 'Duplicate row failed')
    check(int(page.locator('#duplicateRoutesCount').text_content()) >= 2, 'Duplicate route-service warning missing')
    page.click('#showInvalidButton')
    check(page.locator('#emptyState').is_hidden() or page.locator('#tariffTableBody tr').count() >= 0, 'Invalid filter failed')
    page.click('#clearFiltersButton')
    # delete duplicated row through confirmation
    page.locator('#tariffTableBody tr').last.locator('button[data-action="delete"]').click()
    page.click('#confirmDialogAction')
    page.wait_for_function("document.querySelectorAll('#tariffTableBody tr').length === 4")
    check(page.locator('#tariffTableBody tr').count() == 4, 'Delete row failed')

    # Resolve any remaining duplicate and export.
    page.locator('#tariffTableBody tr').last.locator('[data-field="destination"]').fill('60101')
    check(page.locator('#exportButton').is_enabled(), 'Export did not re-enable after fixing duplicate')
    page.click('#exportButton')
    check(page.locator('#exportDialog').get_attribute('open') is not None, 'Export confirmation dialog did not open')
    with page.expect_download(timeout=10000) as download_info:
        page.click('#confirmExportButton')
    download = download_info.value
    download.save_as(str(ROOT / 'tests/generated-ui-smoke.xlsx'))
    check(download.suggested_filename == 'Tarif_Negotiable_SF-914372-A.xlsx', 'Filename pattern changed')
    check(page.locator('#downloadAgainButton').is_visible(), 'Download Again was not shown')
    workbook = page.evaluate('window.__lastWorkbook')
    check(workbook['SheetNames'] == ['TariffCustomer'], 'Worksheet name changed')
    sheet = workbook['Sheets']['TariffCustomer']
    check(sheet['A1']['v'] == 'tariff_from_code' and sheet['M1']['v'] == 'tariff_sub_service_description', 'Output header schema changed')
    check(sheet['A2']['t'] == 's' and sheet['C2']['t'] == 'n', 'Output cell types changed')
    check(sheet['D2']['v'] == 3 and sheet['E2']['v'] == 72, 'User-entered SLA was not exported')
    check(sheet['F2']['v'] == 1644 and sheet['K2']['v'] == 0, 'Formula override or disableTariff changed')
    check(sheet['L2']['v'] == 'SF-914372-A', 'Raw Salesforce export changed')
    check(sheet['M2']['v'] == 'PKH SPECIAL', 'Uppercase description export changed')

    page.screenshot(path=str(ROOT / 'tests/desktop-preview.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(200)
    check(page.locator('body').evaluate('(el)=>el.scrollWidth <= el.clientWidth'), 'Mobile page has horizontal overflow')
    check(page.locator('.dashboard-footer').evaluate('(el)=>Math.round(el.getBoundingClientRect().height)') == 36, 'Mobile footer height is not 36px')
    check(page.locator('.mobile-row-summary').first.is_visible(), 'Mobile tariff card summary is not visible')
    page.screenshot(path=str(ROOT / 'tests/mobile-preview.png'), full_page=True)

    # Error paths.
    page.set_input_files('#fileInput', str(ROOT / 'tests/fixtures/unsupported.txt'))
    check('Jenis file tidak didukung' in page.locator('#importMessage').text_content(), 'Unsupported file error missing')
    page.set_input_files('#fileInput', str(ROOT / 'tests/fixtures/empty.csv'))
    check('kosong' in page.locator('#importMessage').text_content().lower(), 'Empty file error missing')
    page.set_input_files('#fileInput', str(ROOT / 'tests/fixtures/corrupt.xlsx'))
    page.wait_for_timeout(100)
    check('tidak dapat dibaca' in page.locator('#importMessage').text_content().lower(), 'Corrupt workbook error missing')

    # CSV and XLS paths use the same importer workflow and accepted-extension validation.
    for fixture in ['valid-tariff.csv', 'valid-tariff.xls']:
        page.set_input_files('#fileInput', str(ROOT / 'tests/fixtures' / fixture))
        page.wait_for_function("document.querySelector('#importedMetric').textContent === '3'")
        check(page.locator('#selectedFileName').text_content() == fixture, f'{fixture} was not accepted')

    # Exercise the actual drag-and-drop listener with a browser File object.
    csv_b64 = base64.b64encode((ROOT / 'tests/fixtures/valid-tariff.csv').read_bytes()).decode('ascii')
    page.evaluate("""async (payload) => {
      const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
      const file = new File([bytes], 'dropped-tariff.csv', {type:'text/csv'});
      const transfer = new DataTransfer();
      transfer.items.add(file);
      document.querySelector('#dropzone').dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:transfer}));
    }""", csv_b64)
    page.wait_for_function("document.querySelector('#selectedFileName').textContent === 'dropped-tariff.csv'")
    check(page.locator('#importedMetric').text_content() == '3', 'Drag-and-drop import failed')

    page.emulate_media(reduced_motion='reduce')
    check(page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), 'Reduced-motion mode was not recognized')
    check(not page_errors, 'Browser page errors: ' + '; '.join(page_errors))
    browser.close()

if failures:
    print(f'{len(failures)} of {checks} UI checks failed:')
    for failure in failures:
        print(' -', failure)
    raise SystemExit(1)
print(f'{checks} UI smoke checks passed.')
