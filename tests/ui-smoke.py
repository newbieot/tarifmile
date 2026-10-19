from pathlib import Path
import base64
import shutil
import os
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
        chromium = next((str(candidate) for candidate in [
            Path(os.environ.get('PROGRAMFILES', '')) / 'Google/Chrome/Application/chrome.exe',
            Path(os.environ.get('PROGRAMFILES(X86)', '')) / 'Microsoft/Edge/Application/msedge.exe',
            Path(p.chromium.executable_path),
        ] if candidate.is_file()), None)
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
    check(page.locator('#appVersion').text_content() == 'Versi 2.0.1', 'Visible application version is missing')
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

    # Zone postcodes and the user's REGULER=PKH / NEXTDAY=PE mapping.
    page.evaluate("""window.XLSX._nextRows = [
      [],
      ['NO', 'KODEPOS\\nASAL', 'KODEPOS ASAL ZONA', 'KODEPOS\\nTUJUAN', 'KODEPOS TUJUAN ZONA',
       'TARIF (Rp)\\nREGULER\\nPER KG (TERBARU)', 'TARIF (Rp)\\nNEXTDAY\\nPER KG (TERBARU)', 'Layanan', 'Layanan'],
      [1, 29411, 29400, 10110, 10000, 32400, 55200, 'PE', 'PKH'],
      [2, 29411, 29400, 10120, 10000, 32400, 55200, 'PE', 'PKH'],
      [3, 29411, 29400, 14530, 14530, 44400, 0, 'PE', 'PKH']
    ]""")
    page.set_viewport_size({'width': 1440, 'height': 1000})
    for tariff_type, service_id, tariff, description in [('reguler', '420', '32400', 'PKH'), ('nextday', '411', '55200', 'PE')]:
        page.select_option('#importTariffType', tariff_type)
        page.set_input_files('#fileInput', str(xlsx))
        page.wait_for_function("([price,service,count]) => { const first = document.querySelector('#tariffTableBody tr'); return document.querySelector('#importedMetric').textContent === count && first.querySelector('[data-field=minimumTariff]').value === price && first.querySelector('[data-field=serviceId]').value === service; }", arg=[tariff, service_id, '2' if tariff_type == 'reguler' else '1'])
        first = page.locator('#tariffTableBody tr').first
        check(first.locator('[data-field="origin"]').input_value() == '29400', 'Zone origin column was not used')
        check(first.locator('[data-field="destination"]').input_value() == '10000', 'Zone destination column was not used')
        check(first.locator('[data-field="description"]').input_value() == description, 'Zone description did not follow selected service')
        check(first.locator('[data-field="incrementTariff"]').input_value() == tariff, 'Zone increment tariff mismatch')
        check(page.locator('#duplicatesMetric').text_content() == '1', 'Zone duplicate count mismatch')
        check(f'Tarif {tariff_type.upper()}' in page.locator('#importSummaryText').text_content(), 'Selected tariff source missing from summary')
    check(page.locator('#tariffTableBody tr').count() == 1, 'An unavailable NEXTDAY tariff created a PE row')

    # A different tariff in the same zone uses the highest value and displays a warning.
    page.evaluate('window.XLSX._nextRows[3][6] = 60000')
    page.select_option('#statusFilter', 'critical')
    page.set_input_files('#fileInput', str(xlsx))
    page.wait_for_function("document.querySelector('#reviewMetric').textContent === '1'")
    check(page.locator('#tariffTableBody tr').first.locator('[data-field="minimumTariff"]').input_value() == '60000', 'Highest source minimum tariff was not used')
    check(page.locator('#tariffTableBody tr').first.locator('[data-field="incrementTariff"]').input_value() == '60000', 'Highest source increment tariff was not used')
    check('tarif berbeda' in page.locator('#importSummaryText').text_content(), 'Zone tariff conflict summary missing')
    check('tarif tertinggi' in page.locator('#importSummaryText').text_content().lower(), 'Duplicate tariff choice is not explained')
    check(page.locator('#invalidRoutesCount').text_content() == '0', 'Tariff difference should be a warning')
    check(page.locator('#reviewRoutesCount').text_content() == '1', 'Tariff difference warning was not displayed')
    check('Memakai tarif tertinggi: 60000' in page.locator('#tariffTableBody tr').first.locator('[data-role="row-message"]').text_content(), 'Row warning does not explain the selected highest price')
    check(page.locator('#exportButton').is_enabled(), 'Source tariffs with a warning must remain exportable')
    check(page.locator('#statusFilter').input_value() == 'all', 'Successful import must reset the previous status filter')
    page.click('#exportButton')
    check('Rute dengan Peringatan1' in page.locator('#exportConfirmGrid').text_content(), 'Export confirmation omitted the warning count')
    check('Memakai tarif tertinggi' in page.locator('#exportConfirmGrid').text_content(), 'Export confirmation does not explain the duplicate tariff rule')
    with page.expect_download(timeout=10000):
        page.click('#confirmExportButton')
    check('60000' in page.evaluate("window.__lastWorkbook.Sheets.TariffCustomer.G2.v"), 'Export lost the highest source tariff')

    # Both services, customer metadata, contract dates, and SLA are automatic.
    page.evaluate("""window.XLSX._nextRows = [
      [],
      ['KODEPOS ASAL ZONA', 'KODEPOS TUJUAN ZONA', 'TARIF REGULER', 'TARIF NEXTDAY',
       'ID PELANGGAN', 'Kode Salesforce PE', 'Kode Salesforce PKH'],
      [29400, 10000, 32400, 0, 'AUTO-CUSTOMER', 897924, 898845],
      [29400, 10000, 32400, 55200, 'AUTO-CUSTOMER', 897924, 898845],
      [29400, 10000, 32400, 55200, 'AUTO-CUSTOMER', 897924, 898845],
      [29400, 14530, 44400, 0, 'AUTO-CUSTOMER', 897924, 898845]
    ]""")
    page.select_option('#importTariffType', 'both')
    page.set_input_files('#fileInput', str(xlsx))
    page.wait_for_function("document.querySelector('#importedMetric').textContent === '3'")
    check(page.locator('#customerId').input_value() == 'AUTO-CUSTOMER', 'Customer ID was not imported')
    check(page.locator('#salesforceNumber').input_value() == '898845', 'PKH Salesforce was not imported')
    check(page.locator('#salesforcePe').input_value() == '897924', 'PE Salesforce was not imported')
    check(page.locator('#fieldGroupSalesforcePe').is_visible(), 'Per-service Salesforce fields are hidden')
    check(page.locator('#startDate').input_value() == '2026-10-16', 'Import start date mismatch')
    check(page.locator('#endDate').input_value() == '2029-09-30', 'Import end date mismatch')
    check(page.locator('#tariffTableBody tr').count() == 3, 'Unavailable PE routes should be omitted')
    for index, days in enumerate(['4', '2', '4']):
        check(page.locator('#tariffTableBody tr').nth(index).locator('[data-field="slaDays"]').input_value() == days, 'Automatic service SLA mismatch')
    check(page.locator('#exportButton').is_enabled(), 'Automatic import should be ready without manual form edits')
    check(page.locator('#tariffTableBody tr').nth(1).locator('[data-field="minimumTariff"]').input_value() == '55200', 'A zero duplicate erased an available PE tariff')
    check('tanpa tarif NEXTDAY positif dilewati' in page.locator('#importSummaryText').text_content(), 'Unavailable PE summary missing')
    page.fill('#salesforcePe', '')
    check(page.locator('#exportButton').is_disabled(), 'Missing PE Salesforce must prevent export')
    page.fill('#salesforcePe', 'invalid')
    check(page.locator('#exportButton').is_disabled(), 'Invalid PE Salesforce must prevent export')
    page.fill('#salesforcePe', '897924')
    page.click('#exportButton')
    with page.expect_download(timeout=10000):
        page.click('#confirmExportButton')
    mixed_sheet = page.evaluate("window.__lastWorkbook.Sheets.TariffCustomer")
    check(mixed_sheet['L2']['v'] == '898845' and mixed_sheet['L3']['v'] == '897924', 'Exported Salesforce codes crossed services')
    check(mixed_sheet['D2']['v'] == 4 and mixed_sheet['D3']['v'] == 2, 'Exported service SLA mismatch')
    check(mixed_sheet['H2']['v'] == '2026-10-16' and mixed_sheet['I3']['v'] == '2029-09-30', 'Exported import contract dates mismatch')
    check('898845_897924' in page.locator('#exportFilename').text_content(), 'Mixed Salesforce filename mismatch')

    page.evaluate("window.XLSX._nextRows[3][4] = 'OTHER-CUSTOMER'")
    page.set_input_files('#fileInput', str(xlsx))
    page.wait_for_function("document.querySelector('#selectedFileStatus').textContent === 'Impor gagal'")
    check('ID Pelanggan berbeda' in page.locator('#importMessage').text_content(), 'Inconsistent customer error missing')
    check(page.locator('#customerId').input_value() == 'AUTO-CUSTOMER', 'Failed import changed the existing customer')

    # KRT uses only Base Tariff and a required IO, without a Salesforce input.
    page.set_content(html, wait_until='load')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.fill('#customerId', 'KRT-CUSTOMER')
    page.fill('#startDate', '2026-10-19')
    page.fill('#endDate', '2029-09-30')
    first = page.locator('#tariffTableBody tr').first
    first.locator('[data-field="serviceId"]').select_option('470')
    check(page.locator('#fieldGroupInternalOrder').is_visible(), 'KRT IO field did not appear')
    check(page.locator('#fieldGroupSalesforce').is_hidden(), 'KRT should not ask for Salesforce')
    check(page.locator('#primaryTariffHeader').text_content() == 'Base Tariff', 'KRT header should show Base Tariff')
    check(first.locator('[data-field="minimumTariff"], [data-field="incrementTariff"], [data-field="minimumWeight"], [data-field="incrementWeight"]').count() == 0, 'KRT still renders standard tariff inputs')
    check(first.locator('[data-field="formulaIdOverride"]').is_disabled(), 'KRT formula should be fixed')
    check('1644' in first.locator('[data-field="formulaIdOverride"]').text_content(), 'KRT Formula ID mismatch')
    first.locator('[data-field="origin"]').fill('01234')
    first.locator('[data-field="destination"]').fill('00110')
    first.locator('[data-field="description"]').fill('KRT CBA')
    page.fill('#internalOrder', '00100021859')
    check(page.locator('#exportButton').is_disabled(), 'IO alone must not bypass missing Base Tariff and SLA')
    first.locator('[data-field="baseTariff"]').fill('10000')
    check(page.locator('#exportButton').is_disabled(), 'Base Tariff must not bypass missing SLA')
    first.locator('[data-field="slaDays"]').fill('14')
    check(page.locator('#exportButton').is_enabled(), 'KRT with Base Tariff, SLA, and IO should export')
    page.fill('#internalOrder', '   ')
    check(page.locator('#exportButton').is_disabled(), 'Blank KRT IO must block export')
    check('No IO wajib' in page.locator('#internalOrderError').text_content(), 'Missing KRT IO error not shown')
    page.fill('#internalOrder', '00100021859')
    page.click('#exportButton')
    check('TariffCbaCustomer' in page.locator('#exportConfirmGrid').text_content(), 'KRT confirmation sheet name mismatch')
    check('00100021859' in page.locator('#exportConfirmGrid').text_content(), 'KRT confirmation omitted IO')
    with page.expect_download(timeout=10000) as krt_download:
        page.click('#confirmExportButton')
    check(krt_download.value.suggested_filename == 'Tarif_KRT_916479.xlsx', 'KRT output filename mismatch')
    krt_sheet = page.evaluate('window.__lastWorkbook.Sheets.TariffCbaCustomer')
    check(krt_sheet['!ref'] == 'A1:N2' and krt_sheet['N1']['v'] == 'internal_order', 'KRT 14-column output mismatch')
    check(krt_sheet['N2'] == {'v': '00100021859', 't': 's'}, 'KRT IO must preserve leading zeroes as text')
    check(krt_sheet['L2']['v'] == '916479', 'KRT subservice code mismatch')
    check(krt_sheet['G2']['v'] == '{"base_tariff":"10000","kdlayanan_pelanggan":915903}', 'KRT JSON should use only Base Tariff and its customer service code')
    page.fill('#internalOrder', 'IO-CHANGED')
    check(page.locator('#downloadAgainButton').is_hidden(), 'Changing IO must invalidate previous download')
    page.screenshot(path=str(ROOT / 'tests/krt-desktop-preview.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    check(page.locator('body').evaluate('(el)=>el.scrollWidth <= el.clientWidth'), 'Mobile KRT page has horizontal overflow')
    check(first.locator('[data-field="baseTariff"]').is_visible(), 'Mobile KRT Base Tariff is hidden')
    check(first.locator('.krt-unused-cell').first.is_hidden(), 'Mobile KRT shows unused standard columns')
    page.screenshot(path=str(ROOT / 'tests/krt-mobile-preview.png'), full_page=True)
    page.set_viewport_size({'width': 1440, 'height': 1000})

    # Switching services restores the matching fields and keeps KRT Base Tariff.
    first.locator('[data-field="serviceId"]').select_option('420')
    check(page.locator('#fieldGroupInternalOrder').is_hidden(), 'Standard service still requests IO')
    check(first.locator('[data-field="minimumTariff"]').is_visible(), 'Standard tariff input did not return')
    check(page.locator('#fieldGroupSalesforce').is_visible(), 'Standard Salesforce input did not return')
    check(page.locator('#exportButton').is_disabled(), 'Standard service must still require Salesforce and increment tariff')
    first.locator('[data-field="serviceId"]').select_option('470')
    check(first.locator('[data-field="baseTariff"]').input_value() == '10000', 'Switching service erased Base Tariff')

    # Mixed services download two independent workbooks; repeat download includes both.
    page.click('#addRowButton')
    page.fill('#salesforceNumber', 'SF-123')
    last = page.locator('#tariffTableBody tr').last
    for field, value in [('origin', '29400'), ('destination', '10110'), ('slaDays', '4'), ('minimumTariff', '15000'), ('incrementTariff', '14000'), ('description', 'PKH')]:
        last.locator(f'[data-field="{field}"]').fill(value)
    check(page.locator('#fieldGroupInternalOrder').is_visible(), 'Mixed services must still require IO')
    check('Tarif_Negotiable_SF-123.xlsx + Tarif_KRT_916479.xlsx' in page.locator('#exportFilename').text_content(), 'Mixed output summary omitted a file')
    mixed_downloads = []
    page.on('download', lambda download: mixed_downloads.append(download.suggested_filename))
    page.click('#exportButton')
    with page.expect_download(timeout=10000):
        page.click('#confirmExportButton')
    page.wait_for_function("document.querySelector('#downloadAgainButton').hidden === false")
    page.wait_for_timeout(150)
    check(mixed_downloads == ['Tarif_Negotiable_SF-123.xlsx', 'Tarif_KRT_916479.xlsx'], 'Mixed service exports were not split into two downloads')
    with page.expect_download(timeout=10000):
        page.click('#downloadAgainButton')
    page.wait_for_timeout(150)
    check(len(mixed_downloads) == 4, 'Repeat download omitted one of the mixed service files')

    # KRT imports apply Base Tariff to all routes, and a new upload clears prior IO.
    page.evaluate("window.XLSX._nextRows = [['RUTE KANTOR','TARIF','Layanan'],['29400|10110',12000,'CBA'],['29400|10111',13000,'CBA']]")
    page.select_option('#importTariffType', 'krt')
    page.set_input_files('#fileInput', str(xlsx))
    page.wait_for_function("document.querySelector('#importedMetric').textContent === '2'")
    check(page.locator('[data-field="baseTariff"]').count() == 2, 'KRT import did not create Base Tariff inputs for all routes')
    check(page.locator('#internalOrder').input_value() == '', 'New import retained an IO from another upload')
    check(page.locator('#fieldGroupSalesforce').is_hidden(), 'KRT import still asks for standard Salesforce')
    page.fill('#internalOrder', 'NEW-IO')
    for sla_input in page.locator('[data-field="slaDays"]').all():
        sla_input.fill('14')
    check(page.locator('#exportButton').is_enabled(), 'KRT import could not be completed using only SLA and IO')

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
