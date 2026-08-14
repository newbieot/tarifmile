(function (root) {
  'use strict';

  const T = root.TariffBuilder;
  if (!T) return;

  const state = {
    rows: [T.createDefaultRow({ expanded: true })],
    selectedFile: null,
    importSummary: null,
    filters: { search: '', status: 'all', service: 'all' },
    validation: null,
    generated: null,
    processing: false
  };

  const dom = {};
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function byId(id) { return document.getElementById(id); }

  function cacheDom() {
    [
      'customerId', 'salesforceNumber', 'startDate', 'endDate', 'setupCompletion',
      'customerError', 'salesforceError', 'startError', 'endError',
      'fieldGroupCustomer', 'fieldGroupSalesforce', 'fieldGroupStart', 'fieldGroupEnd',
      'dropzone', 'fileInput', 'fileCard', 'selectedFileName', 'selectedFileMeta', 'selectedFileStatus',
      'replaceFileButton', 'removeFileButton', 'progressBox', 'progressTitle', 'progressDetail',
      'importMessage', 'importSummary', 'sourceRowsMetric', 'importedMetric', 'duplicatesMetric',
      'reviewMetric', 'importSummaryText', 'toggleDuplicatesButton', 'duplicateList',
      'resetRowsButton', 'clearWorkspaceButton', 'addRowButton', 'tariffTableBody',
      'totalRoutesCount', 'readyRoutesCount', 'reviewRoutesCount', 'invalidRoutesCount',
      'duplicateRoutesCount', 'validationSentence', 'rowSearch', 'statusFilter', 'serviceFilter',
      'clearFiltersButton', 'showInvalidButton', 'bulkToolbar', 'selectedRowsText',
      'duplicateSelectedButton', 'deleteSelectedButton', 'selectAllRows', 'emptyState',
      'previewCount', 'previewGrid', 'previewTableBody', 'exportHeadline', 'exportFilename',
      'exportButton', 'downloadAgainButton', 'toastRegion', 'liveStatus', 'helpButton',
      'helpDialog', 'confirmDialog', 'confirmDialogTitle', 'confirmDialogText',
      'confirmDialogAction', 'exportDialog', 'exportConfirmGrid', 'confirmExportButton', 'appVersion'
    ].forEach((id) => { dom[id] = byId(id); });
  }

  function svg(paths, viewBox) {
    const element = document.createElementNS(SVG_NS, 'svg');
    element.setAttribute('viewBox', viewBox || '0 0 24 24');
    element.setAttribute('aria-hidden', 'true');
    paths.forEach((pathData) => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', pathData);
      element.appendChild(path);
    });
    return element;
  }

  function announce(message) {
    dom.liveStatus.textContent = '';
    root.setTimeout(() => { dom.liveStatus.textContent = message; }, 20);
  }

  function showToast(message, type) {
    while (dom.toastRegion.children.length >= 3) dom.toastRegion.firstElementChild.remove();
    const toast = document.createElement('div');
    toast.className = `toast${type ? ` is-${type}` : ''}`;
    toast.textContent = message;
    dom.toastRegion.appendChild(toast);
    root.setTimeout(() => {
      toast.classList.add('is-leaving');
      root.setTimeout(() => toast.remove(), 220);
    }, 4500);
  }

  function getGlobalValues() {
    return {
      customerId: dom.customerId.value,
      salesforceNumber: dom.salesforceNumber.value,
      startDate: dom.startDate.value,
      endDate: dom.endDate.value
    };
  }

  function setProgress(title, detail, visible) {
    dom.progressBox.hidden = !visible;
    if (visible) {
      dom.progressTitle.textContent = title;
      dom.progressDetail.textContent = detail;
      dom.selectedFileStatus.textContent = title;
      announce(`${title}. ${detail}`);
    }
  }

  function setImportMessage(message, type) {
    dom.importMessage.hidden = !message;
    dom.importMessage.className = `inline-message${type ? ` is-${type}` : ''}`;
    dom.importMessage.textContent = message || '';
  }

  function renderServiceOptions() {
    const current = dom.serviceFilter.value || 'all';
    while (dom.serviceFilter.options.length > 1) dom.serviceFilter.remove(1);
    T.SERVICES.forEach((service) => {
      const option = document.createElement('option');
      option.value = String(service.id);
      option.textContent = `${service.name} · ${service.id}`;
      dom.serviceFilter.appendChild(option);
    });
    dom.serviceFilter.value = current;
  }

  function createServiceSelect(row) {
    const select = document.createElement('select');
    select.dataset.field = 'serviceId';
    select.setAttribute('aria-label', `Layanan untuk rute ${row.id}`);
    T.SERVICES.forEach((service) => {
      const option = document.createElement('option');
      option.value = String(service.id);
      option.textContent = `${service.name} · ${service.id}`;
      option.selected = Number(row.serviceId) === service.id;
      select.appendChild(option);
    });
    return select;
  }

  function createFormulaSelect(row) {
    const select = document.createElement('select');
    select.dataset.field = 'formulaIdOverride';
    select.setAttribute('aria-label', `Formula ID untuk rute ${row.id}`);
    const automatic = document.createElement('option');
    const mapped = T.getServiceFormulaId(row.serviceId);
    automatic.value = '';
    automatic.textContent = Number.isFinite(mapped)
      ? `Otomatis · ${mapped}`
      : 'Otomatis · tidak tersedia';
    automatic.selected = String(row.formulaIdOverride ?? '') === '';
    select.appendChild(automatic);
    T.FORMULA_OVERRIDE_OPTIONS.forEach((formula) => {
      const option = document.createElement('option');
      option.value = String(formula.id);
      option.textContent = `${formula.id} · ${formula.name} (manual)`;
      option.selected = Number(row.formulaIdOverride) === formula.id;
      select.appendChild(option);
    });
    return select;
  }

  function createInput(row, field, type, attributes) {
    const input = document.createElement('input');
    input.type = type;
    input.dataset.field = field;
    input.value = row[field] ?? '';
    input.setAttribute('aria-label', `${field.replace(/([A-Z])/g, ' $1')} untuk rute ${row.id}`);
    Object.entries(attributes || {}).forEach(([name, value]) => input.setAttribute(name, value));
    return input;
  }

  function createCell(label, child, field) {
    const td = document.createElement('td');
    td.dataset.label = label;
    if (field) td.className = 'field-cell';
    td.appendChild(child);
    if (field) {
      const error = document.createElement('span');
      error.className = 'cell-error';
      error.dataset.errorFor = field;
      td.appendChild(error);
    }
    return td;
  }

  function firstRowMessage(result) {
    const error = Object.values(result.errors)[0];
    if (error) return error;
    return result.warnings[0] || '';
  }

  function createMobileSummary(row, result) {
    const td = document.createElement('td');
    td.className = 'mobile-row-summary';
    const wrap = document.createElement('div');
    wrap.className = 'mobile-summary-inner';
    const main = document.createElement('div');
    main.className = 'mobile-summary-main';
    const route = document.createElement('strong');
    route.className = 'mobile-route';
    route.textContent = `${row.origin || 'Asal'} → ${row.destination || 'Tujuan'}`;
    const meta = document.createElement('span');
    meta.className = 'mobile-meta';
    const serviceText = document.createElement('span');
    serviceText.textContent = T.getServiceLabel(row.serviceId);
    const tariffText = document.createElement('span');
    tariffText.textContent = row.minimumTariff === '' ? 'Tarif belum lengkap' : `Rp ${Number(row.minimumTariff).toLocaleString('id-ID')}`;
    const status = document.createElement('span');
    status.className = `status-badge ${result.status}`;
    status.dataset.role = 'row-status';
    status.textContent = result.statusLabel;
    meta.append(serviceText, tariffText, status);
    main.append(route, meta);
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'expand-row-button';
    expand.dataset.action = 'expand';
    expand.setAttribute('aria-label', row.expanded ? 'Tutup detail rute tarif' : 'Buka detail rute tarif');
    expand.appendChild(svg(['m6 9 6 6 6-6']));
    wrap.append(main, expand);
    td.appendChild(wrap);
    return td;
  }

  function createRowElement(row, rowIndex, result) {
    const tr = document.createElement('tr');
    tr.dataset.rowId = row.id;
    if (row.selected) tr.classList.add('is-selected');
    if (row.expanded) tr.classList.add('is-expanded');
    if (result.status === 'invalid' || result.status === 'incomplete') tr.classList.add('is-invalid');
    if (result.status === 'needs-review') tr.classList.add('is-needs-review');

    tr.appendChild(createMobileSummary(row, result));

    const selectBox = document.createElement('input');
    selectBox.type = 'checkbox';
    selectBox.checked = row.selected;
    selectBox.dataset.action = 'select';
    selectBox.setAttribute('aria-label', `Pilih rute tarif ${rowIndex + 1}`);
    tr.appendChild(createCell('Pilih', selectBox));

    const rowNumber = document.createElement('span');
    rowNumber.className = 'row-number';
    rowNumber.textContent = String(rowIndex + 1);
    tr.appendChild(createCell('Nomor', rowNumber));

    const statusWrap = document.createElement('div');
    statusWrap.className = 'status-cell';
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${result.status}`;
    statusBadge.dataset.role = 'row-status';
    statusBadge.textContent = result.statusLabel;
    const statusMessage = document.createElement('span');
    statusMessage.className = result.errors && Object.keys(result.errors).length ? 'row-error-summary' : 'row-review-summary';
    statusMessage.dataset.role = 'row-message';
    statusMessage.textContent = firstRowMessage(result);
    statusWrap.append(statusBadge, statusMessage);
    tr.appendChild(createCell('Status', statusWrap));

    tr.appendChild(createCell('Asal', createInput(row, 'origin', 'text', { placeholder: '29400', inputmode: 'text', maxlength: '12', spellcheck: 'false' }), 'origin'));
    tr.appendChild(createCell('Tujuan', createInput(row, 'destination', 'text', { placeholder: '10110', inputmode: 'text', maxlength: '12', spellcheck: 'false' }), 'destination'));
    tr.appendChild(createCell('Layanan', createServiceSelect(row), 'serviceId'));
    tr.appendChild(createCell('Formula ID', createFormulaSelect(row), 'formulaIdOverride'));

    const sla = T.getSla(row.slaDays);
    const slaBox = document.createElement('div');
    slaBox.className = 'sla-display';
    const slaDays = createInput(row, 'slaDays', 'number', { min: '1', step: '1', inputmode: 'numeric', placeholder: 'Hari', required: 'required' });
    const slaHours = document.createElement('small');
    slaHours.className = 'sla-hours';
    slaHours.textContent = Number.isFinite(sla.hours) ? `${sla.hours} jam` : 'Wajib diisi';
    slaBox.append(slaDays, slaHours);
    tr.appendChild(createCell('SLA (hari)', slaBox, 'slaDays'));

    tr.appendChild(createCell('Berat Minimum', createInput(row, 'minimumWeight', 'number', { min: '1', step: '1', inputmode: 'numeric' }), 'minimumWeight'));
    tr.appendChild(createCell('Tarif Minimum', createInput(row, 'minimumTariff', 'number', { min: '0', step: '1', inputmode: 'decimal', placeholder: '0' }), 'minimumTariff'));
    tr.appendChild(createCell('Berat Kelipatan', createInput(row, 'incrementWeight', 'number', { min: '1', step: '1', inputmode: 'numeric' }), 'incrementWeight'));
    tr.appendChild(createCell('Tarif Kelipatan', createInput(row, 'incrementTariff', 'number', { min: '0', step: '1', inputmode: 'decimal', placeholder: '0' }), 'incrementTariff'));
    tr.appendChild(createCell('Deskripsi', createInput(row, 'description', 'text', { placeholder: 'Deskripsi tarif', spellcheck: 'false' }), 'description'));

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const duplicate = document.createElement('button');
    duplicate.type = 'button';
    duplicate.className = 'icon-button';
    duplicate.dataset.action = 'duplicate';
    duplicate.setAttribute('aria-label', `Duplikat rute tarif ${rowIndex + 1}`);
    duplicate.title = 'Duplikat baris';
    duplicate.appendChild(svg(['M8 8h11v11H8z', 'M5 16H4V5h11v1']));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-button icon-button--danger';
    remove.dataset.action = 'delete';
    remove.setAttribute('aria-label', `Hapus rute tarif ${rowIndex + 1}`);
    remove.title = 'Hapus baris';
    remove.appendChild(svg(['M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5']));
    actions.append(duplicate, remove);
    tr.appendChild(createCell('Tindakan', actions));

    return tr;
  }

  function validationFor(rowId) {
    return state.validation.rows.results.find((result) => result.rowId === rowId);
  }

  function filteredRows() {
    const query = state.filters.search.trim().toLowerCase();
    return state.rows.filter((row) => {
      const result = validationFor(row.id);
      const searchMatch = !query || [row.origin, row.destination, row.description, T.getServiceLabel(row.serviceId)]
        .some((value) => String(value).toLowerCase().includes(query));
      const statusMatch = state.filters.status === 'all' || result.status === state.filters.status || (state.filters.status === 'critical' && (result.status === 'invalid' || result.status === 'incomplete'));
      const serviceMatch = state.filters.service === 'all' || String(row.serviceId) === state.filters.service;
      return searchMatch && statusMatch && serviceMatch;
    });
  }

  function renderRows() {
    const visibleRows = filteredRows();
    const fragment = document.createDocumentFragment();
    visibleRows.forEach((row) => {
      fragment.appendChild(createRowElement(row, state.rows.indexOf(row), validationFor(row.id)));
    });
    dom.tariffTableBody.replaceChildren(fragment);
    dom.emptyState.hidden = visibleRows.length > 0;
    syncSelectAll();
  }

  function syncRowDom(rowId) {
    const row = state.rows.find((item) => item.id === rowId);
    const result = validationFor(rowId);
    const tr = dom.tariffTableBody.querySelector(`tr[data-row-id="${CSS.escape(rowId)}"]`);
    if (!row || !result || !tr) return;

    tr.classList.toggle('is-invalid', result.status === 'invalid' || result.status === 'incomplete');
    tr.classList.toggle('is-needs-review', result.status === 'needs-review');
    tr.classList.toggle('is-selected', row.selected);
    tr.classList.toggle('is-expanded', row.expanded);

    tr.querySelectorAll('[data-role="row-status"]').forEach((badge) => {
      badge.className = `status-badge ${result.status}`;
      badge.textContent = result.statusLabel;
    });
    const rowMessage = tr.querySelector('[data-role="row-message"]');
    if (rowMessage) {
      rowMessage.className = Object.keys(result.errors).length ? 'row-error-summary' : 'row-review-summary';
      rowMessage.textContent = firstRowMessage(result);
    }
    tr.querySelectorAll('[data-error-for]').forEach((error) => {
      const field = error.dataset.errorFor;
      error.textContent = result.errors[field] || '';
      const input = tr.querySelector(`[data-field="${field}"]`);
      if (input) {
        input.classList.toggle('has-error', Boolean(result.errors[field]));
        input.setAttribute('aria-invalid', result.errors[field] ? 'true' : 'false');
      }
    });
    const formulaSelect = tr.querySelector('[data-field="formulaIdOverride"]');
    if (formulaSelect && formulaSelect.options[0]) {
      const mappedFormula = T.getServiceFormulaId(row.serviceId);
      formulaSelect.options[0].textContent = Number.isFinite(mappedFormula)
        ? `Otomatis · ${mappedFormula}`
        : 'Otomatis · tidak tersedia';
    }
    const sla = T.getSla(row.slaDays);
    const slaBox = tr.querySelector('.sla-display');
    if (slaBox) {
      const hours = slaBox.querySelector('.sla-hours');
      if (hours) hours.textContent = Number.isFinite(sla.hours) ? `${sla.hours} jam` : 'Wajib diisi';
    }
    const mobileRoute = tr.querySelector('.mobile-route');
    if (mobileRoute) mobileRoute.textContent = `${row.origin || 'Asal'} → ${row.destination || 'Tujuan'}`;
    const mobileMeta = tr.querySelector('.mobile-meta');
    if (mobileMeta) {
      const spans = mobileMeta.querySelectorAll(':scope > span');
      if (spans[0]) spans[0].textContent = T.getServiceLabel(row.serviceId);
      if (spans[1]) spans[1].textContent = row.minimumTariff === '' ? 'Tarif belum lengkap' : `Rp ${Number(row.minimumTariff).toLocaleString('id-ID')}`;
    }
  }

  function renderGlobalValidation() {
    const result = state.validation.globals;
    const fields = [
      ['customerId', 'customerError', 'fieldGroupCustomer'],
      ['salesforceNumber', 'salesforceError', 'fieldGroupSalesforce'],
      ['startDate', 'startError', 'fieldGroupStart'],
      ['endDate', 'endError', 'fieldGroupEnd']
    ];
    fields.forEach(([field, errorId, groupId]) => {
      const message = result.errors[field] || '';
      dom[errorId].textContent = message;
      dom[groupId].classList.toggle('has-error', Boolean(message));
      dom[field].setAttribute('aria-invalid', message ? 'true' : 'false');
    });
    if (result.valid) {
      dom.setupCompletion.textContent = 'Data pelanggan lengkap';
      dom.setupCompletion.classList.add('is-complete');
    } else {
      dom.setupCompletion.textContent = `Lengkapi ${result.remainingFields} kolom wajib`;
      dom.setupCompletion.classList.remove('is-complete');
    }
  }

  function renderValidationSummary() {
    const counts = state.validation.rows.counts;
    dom.totalRoutesCount.textContent = counts.total;
    dom.readyRoutesCount.textContent = counts.ready;
    dom.reviewRoutesCount.textContent = counts.needsReview;
    dom.invalidRoutesCount.textContent = counts.invalid + counts.incomplete;
    dom.duplicateRoutesCount.textContent = counts.duplicates;
    const acceptable = counts.ready + counts.needsReview;
    if (!counts.total) dom.validationSentence.textContent = 'Tambahkan rute tarif untuk melanjutkan.';
    else if (state.validation.exportable) dom.validationSentence.textContent = `${acceptable} dari ${counts.total} rute tarif siap diekspor.`;
    else if (counts.critical) dom.validationSentence.textContent = `${counts.critical} rute tarif harus diperbaiki sebelum ekspor.`;
    else dom.validationSentence.textContent = `${acceptable} dari ${counts.total} rute tarif siap ditinjau.`;
  }

  function renderWorkflow() {
    const steps = Array.from(document.querySelectorAll('.workflow-step'));
    const globalComplete = state.validation.globals.valid;
    const importedOrEdited = state.selectedFile || state.rows.some((row) => row.origin || row.destination || row.minimumTariff !== '' || row.description);
    const validated = state.validation.exportable;
    const exported = Boolean(state.generated);
    const complete = [globalComplete, importedOrEdited, validated, exported];
    let active = complete.findIndex((value) => !value);
    if (active === -1) active = 3;
    steps.forEach((step, index) => {
      step.classList.toggle('is-complete', complete[index] && index < active + (exported ? 1 : 0));
      step.classList.toggle('is-active', index === active);
    });
  }

  function buildPreviewRecords() {
    if (!state.validation.globals.valid) return [];
    return state.rows.map((row, index) => {
      const result = state.validation.rows.results[index];
      if (result.critical) return null;
      try { return T.buildExportRecord(getGlobalValues(), row); } catch (_) { return null; }
    }).filter(Boolean);
  }

  function addPreviewItem(label, value) {
    const item = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = label;
    const content = document.createElement('span');
    content.textContent = value;
    item.append(title, content);
    return item;
  }

  function renderPreview() {
    const globalValues = getGlobalValues();
    const records = buildPreviewRecords();
    dom.previewCount.textContent = `${records.length} baris siap`;
    const services = [...new Set(records.map((record) => String(record.service_id)))].join(', ') || '—';
    dom.previewGrid.replaceChildren(
      addPreviewItem('ID Pelanggan', globalValues.customerId ? T.normalizeCustomerId(globalValues.customerId) : '—'),
      addPreviewItem('Salesforce', globalValues.salesforceNumber || '—'),
      addPreviewItem('Periode Berlaku', globalValues.startDate && globalValues.endDate ? `${globalValues.startDate} → ${globalValues.endDate}` : '—'),
      addPreviewItem('Rute Siap', String(records.length)),
      addPreviewItem('Layanan', services),
      addPreviewItem('Lembar Kerja', T.DEFAULTS.worksheetName)
    );

    const fragment = document.createDocumentFragment();
    records.slice(0, 100).forEach((record) => {
      const tr = document.createElement('tr');
      [
        record.tariff_from_code,
        record.tariff_to_code,
        String(record.service_id),
        `${record.tariff_sla_day} hari · ${record.tariff_sla_hours} jam`,
        String(record.tariff_formula_id),
        record.tariff_formula_data,
        record.customer_type_code,
        record.tariff_sub_service_code,
        record.tariff_sub_service_description
      ].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      fragment.appendChild(tr);
    });
    dom.previewTableBody.replaceChildren(fragment);
  }

  function renderExportBar() {
    const globalValues = getGlobalValues();
    const filename = globalValues.salesforceNumber ? T.getOutputFilename(globalValues.salesforceNumber) : 'Tarif_Negotiable_<Nomor Salesforce>.xlsx';
    dom.exportFilename.textContent = `File keluaran: ${filename}`;
    dom.exportButton.disabled = !state.validation.exportable || state.processing || !root.XLSX;
    if (!root.XLSX) dom.exportHeadline.textContent = 'SheetJS tidak tersedia. Periksa koneksi lalu muat ulang halaman.';
    else if (state.processing) dom.exportHeadline.textContent = 'Memproses workbook yang dipilih…';
    else if (state.validation.exportable) dom.exportHeadline.textContent = `${state.validation.readyCount} rute tarif siap diekspor.`;
    else dom.exportHeadline.textContent = 'Lengkapi data pelanggan, SLA, dan validasi seluruh rute sebelum ekspor.';
    dom.downloadAgainButton.hidden = !state.generated;
  }

  function renderBulkToolbar() {
    const selected = state.rows.filter((row) => row.selected).length;
    dom.bulkToolbar.hidden = selected === 0;
    dom.selectedRowsText.textContent = `${selected} baris dipilih`;
  }

  function syncSelectAll() {
    const visible = filteredRows();
    const selectedVisible = visible.filter((row) => row.selected).length;
    dom.selectAllRows.checked = visible.length > 0 && selectedVisible === visible.length;
    dom.selectAllRows.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  }

  function refresh(options) {
    const opts = options || {};
    state.validation = T.validateWorkspace(getGlobalValues(), state.rows);
    renderGlobalValidation();
    renderValidationSummary();
    if (opts.renderRows) renderRows();
    else if (opts.rowId) syncRowDom(opts.rowId);
    renderBulkToolbar();
    syncSelectAll();
    renderPreview();
    renderExportBar();
    renderWorkflow();
  }

  function clearGenerated() {
    state.generated = null;
    dom.downloadAgainButton.hidden = true;
  }

  function focusRow(rowId, field) {
    root.requestAnimationFrame(() => {
      const selector = `tr[data-row-id="${CSS.escape(rowId)}"] [data-field="${field || 'origin'}"]`;
      const input = dom.tariffTableBody.querySelector(selector);
      if (input) input.focus();
    });
  }

  function addRow(overrides, shouldFocus) {
    const row = T.createDefaultRow({ ...(overrides || {}), expanded: true });
    state.rows.push(row);
    clearGenerated();
    refresh({ renderRows: true });
    if (shouldFocus !== false) focusRow(row.id, 'origin');
    return row;
  }

  function duplicateRows(rowsToDuplicate) {
    const newRows = [];
    rowsToDuplicate.forEach((row) => {
      const copy = T.createDefaultRow({
        origin: row.origin,
        destination: row.destination,
        serviceId: row.serviceId,
        formulaIdOverride: row.formulaIdOverride,
        slaDays: row.slaDays,
        minimumWeight: row.minimumWeight,
        minimumTariff: row.minimumTariff,
        incrementWeight: row.incrementWeight,
        incrementTariff: row.incrementTariff,
        description: row.description,
        importNeedsReview: true,
        importReviewMessage: 'Baris diduplikasi. Ubah rute atau selesaikan peringatan duplikat.',
        expanded: true
      });
      const index = state.rows.indexOf(row);
      state.rows.splice(index + 1, 0, copy);
      newRows.push(copy);
    });
    state.rows.forEach((row) => { row.selected = false; });
    clearGenerated();
    refresh({ renderRows: true });
    if (newRows[0]) focusRow(newRows[0].id, 'origin');
    showToast(`${newRows.length} baris tarif berhasil diduplikasi.`, 'warning');
  }

  function deleteRows(rowIds) {
    const idSet = new Set(rowIds);
    state.rows = state.rows.filter((row) => !idSet.has(row.id));
    if (state.rows.length === 0) state.rows = [T.createDefaultRow({ expanded: true })];
    clearGenerated();
    refresh({ renderRows: true });
  }

  function showDialog(dialog) {
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  }

  function confirmAction(title, text, actionLabel) {
    return new Promise((resolve) => {
      dom.confirmDialogTitle.textContent = title;
      dom.confirmDialogText.textContent = text;
      dom.confirmDialogAction.textContent = actionLabel || 'Lanjutkan';
      const onClose = () => {
        dom.confirmDialog.removeEventListener('close', onClose);
        resolve(dom.confirmDialog.returnValue === 'confirm');
      };
      dom.confirmDialog.addEventListener('close', onClose);
      showDialog(dom.confirmDialog);
    });
  }

  function renderFileCard(file, status) {
    state.selectedFile = file || null;
    dom.fileCard.hidden = !file;
    if (!file) return;
    dom.selectedFileName.textContent = file.name;
    dom.selectedFileMeta.textContent = `${T.getExtension(file.name).toUpperCase()} · ${T.formatFileSize(file.size)}`;
    dom.selectedFileStatus.textContent = status || 'Siap diproses';
  }

  function renderImportSummary(summary) {
    state.importSummary = summary;
    dom.importSummary.hidden = !summary;
    if (!summary) return;
    dom.sourceRowsMetric.textContent = summary.sourceRowsFound;
    dom.importedMetric.textContent = summary.routesImported;
    dom.duplicatesMetric.textContent = summary.duplicatesSkipped;
    dom.reviewMetric.textContent = summary.rowsRequiringReview;
    const skipped = summary.duplicatesSkipped + summary.emptyRowsSkipped;
    dom.importSummaryText.textContent = `${summary.routesImported} rute tarif diimpor. ${summary.duplicatesSkipped} duplikat dan ${summary.emptyRowsSkipped} baris kosong dilewati.${skipped === 0 ? ' Tidak ada baris sumber yang dilewati.' : ''}`;
    dom.toggleDuplicatesButton.hidden = summary.duplicateRoutes.length === 0;
    dom.duplicateList.hidden = true;
    dom.duplicateList.replaceChildren();
    summary.duplicateRoutes.forEach((route) => {
      const item = document.createElement('span');
      item.textContent = route;
      dom.duplicateList.appendChild(item);
    });
  }

  async function processFile(file) {
    const validation = T.validateSourceFile(file);
    if (!validation.valid) {
      setImportMessage(validation.message, 'error');
      showToast(validation.message, 'error');
      return;
    }
    if (state.processing) return;
    state.processing = true;
    clearGenerated();
    renderFileCard(file, 'Menunggu diproses');
    setImportMessage('', '');
    setProgress('Membaca workbook', 'Menyiapkan file yang dipilih…', true);
    refresh();

    try {
      const result = await T.readWorkbookFile(file, (title, detail) => setProgress(title, detail, true));
      setProgress('Memvalidasi data', 'Memeriksa rute impor dan nilai tarif…', true);
      state.rows = result.rows;
      state.rows[0].expanded = true;
      renderImportSummary(result.summary);
      renderFileCard(file, `${result.summary.routesImported} rute diimpor dari ${result.sheetName}`);
      setImportMessage(`${result.summary.routesImported} rute tarif berhasil diimpor. Isi SLA dan tinjau baris yang disorot sebelum ekspor.`, 'success');
      showToast('Rute tarif berhasil diimpor.', 'success');
      announce(`${result.summary.routesImported} rute tarif diimpor.`);
    } catch (error) {
      setImportMessage(error && error.message ? error.message : 'Workbook yang dipilih tidak dapat diproses.', 'error');
      renderFileCard(file, 'Impor gagal');
      showToast(error && error.message ? error.message : 'Impor gagal.', 'error');
    } finally {
      state.processing = false;
      setProgress('', '', false);
      dom.fileInput.value = '';
      refresh({ renderRows: true });
    }
  }

  function clearImportReference() {
    state.selectedFile = null;
    renderFileCard(null);
    setImportMessage('', '');
    renderImportSummary(null);
    dom.fileInput.value = '';
    showToast('Referensi file impor dihapus. Baris tarif yang telah diedit tetap dipertahankan.', 'success');
    refresh();
  }

  function resetRows() {
    state.rows = [T.createDefaultRow({ expanded: true })];
    state.importSummary = null;
    renderImportSummary(null);
    clearGenerated();
    refresh({ renderRows: true });
    focusRow(state.rows[0].id, 'origin');
  }

  function clearWorkspace() {
    dom.customerId.value = '';
    dom.salesforceNumber.value = '';
    dom.startDate.value = '';
    dom.endDate.value = '';
    state.selectedFile = null;
    renderFileCard(null);
    setImportMessage('', '');
    state.filters = { search: '', status: 'all', service: 'all' };
    dom.rowSearch.value = '';
    dom.statusFilter.value = 'all';
    dom.serviceFilter.value = 'all';
    state.rows = [T.createDefaultRow({ expanded: true })];
    renderImportSummary(null);
    clearGenerated();
    refresh({ renderRows: true });
    dom.customerId.focus();
  }

  function exportSummaryItems() {
    const globals = getGlobalValues();
    const serviceNames = [...new Set(state.rows.map((row) => T.getServiceLabel(row.serviceId)))].join(', ');
    return [
      ['ID Pelanggan', T.normalizeCustomerId(globals.customerId)],
      ['Nomor Salesforce', globals.salesforceNumber],
      ['Periode Berlaku', `${globals.startDate} → ${globals.endDate}`],
      ['Jumlah Rute', String(state.rows.length)],
      ['Rute Valid', String(state.validation.readyCount)],
      ['Layanan Terpilih', serviceNames],
      ['Nama File Keluaran', T.getOutputFilename(globals.salesforceNumber)],
      ['Lembar Kerja', T.DEFAULTS.worksheetName]
    ];
  }

  function openExportDialog() {
    refresh();
    if (!state.validation.exportable) {
      showToast('Selesaikan kesalahan data pelanggan dan rute sebelum ekspor.', 'error');
      return;
    }
    const fragment = document.createDocumentFragment();
    exportSummaryItems().forEach(([label, value]) => fragment.appendChild(addPreviewItem(label, value)));
    dom.exportConfirmGrid.replaceChildren(fragment);
    showDialog(dom.exportDialog);
  }

  function performExport() {
    if (!state.validation.exportable) return;
    state.processing = true;
    setProgress('Menyiapkan workbook', 'Membuat file XLSX yang kompatibel dengan MILE…', true);
    refresh();
    root.setTimeout(() => {
      try {
        const generated = T.generateAndDownload(getGlobalValues(), state.rows);
        state.generated = { blob: generated.blob, filename: generated.filename, createdAt: Date.now() };
        setProgress('Unduhan siap', 'Workbook berhasil dibuat.', true);
        showToast('Workbook berhasil dibuat.', 'success');
        announce('Workbook berhasil dibuat.');
      } catch (error) {
        showToast(error && error.message ? error.message : 'Pembuatan workbook gagal.', 'error');
        announce('Pembuatan workbook gagal.');
      } finally {
        state.processing = false;
        root.setTimeout(() => setProgress('', '', false), 550);
        refresh();
      }
    }, 30);
  }

  function downloadAgain() {
    if (!state.generated) return;
    try {
      T.downloadBlob(state.generated.blob, state.generated.filename);
      showToast('Unduhan workbook dimulai kembali.', 'success');
    } catch (_) {
      showToast('Workbook tidak dapat diunduh kembali. Buat workbook baru.', 'error');
    }
  }

  function bindGlobalEvents() {
    [dom.customerId, dom.salesforceNumber, dom.startDate, dom.endDate].forEach((input) => {
      input.addEventListener('input', () => { clearGenerated(); refresh(); });
      input.addEventListener('change', () => { clearGenerated(); refresh(); });
    });

    dom.helpButton.addEventListener('click', () => showDialog(dom.helpDialog));
    dom.dropzone.addEventListener('click', () => dom.fileInput.click());
    dom.replaceFileButton.addEventListener('click', () => dom.fileInput.click());
    dom.removeFileButton.addEventListener('click', clearImportReference);
    dom.fileInput.addEventListener('change', () => { if (dom.fileInput.files[0]) processFile(dom.fileInput.files[0]); });
    ['dragenter', 'dragover'].forEach((eventName) => dom.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (!state.processing) dom.dropzone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach((eventName) => dom.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropzone.classList.remove('dragover');
    }));
    dom.dropzone.addEventListener('drop', (event) => {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) processFile(file);
    });
    dom.toggleDuplicatesButton.addEventListener('click', () => {
      dom.duplicateList.hidden = !dom.duplicateList.hidden;
      dom.toggleDuplicatesButton.textContent = dom.duplicateList.hidden ? 'Lihat rute yang dilewati' : 'Sembunyikan rute';
    });

    dom.addRowButton.addEventListener('click', () => addRow());
    dom.resetRowsButton.addEventListener('click', async () => {
      const meaningful = state.rows.some((row) => row.origin || row.destination || row.minimumTariff !== '' || row.description);
      if (!meaningful || await confirmAction('Atur ulang baris tarif?', 'Semua rute hasil impor dan edit manual akan diganti dengan satu baris kosong. Data pelanggan tetap dipertahankan.', 'Atur Ulang Baris')) resetRows();
    });
    dom.clearWorkspaceButton.addEventListener('click', async () => {
      const meaningful = state.rows.some((row) => row.origin || row.destination || row.minimumTariff !== '' || row.description) || Object.values(getGlobalValues()).some(Boolean);
      if (!meaningful || await confirmAction('Bersihkan ruang kerja?', 'Data pelanggan, file terpilih, baris tarif, filter, pesan, dan referensi workbook akan dihapus.', 'Bersihkan Ruang Kerja')) clearWorkspace();
    });

    dom.rowSearch.addEventListener('input', () => { state.filters.search = dom.rowSearch.value; refresh({ renderRows: true }); });
    dom.statusFilter.addEventListener('change', () => { state.filters.status = dom.statusFilter.value; refresh({ renderRows: true }); });
    dom.serviceFilter.addEventListener('change', () => { state.filters.service = dom.serviceFilter.value; refresh({ renderRows: true }); });
    dom.clearFiltersButton.addEventListener('click', () => {
      state.filters = { search: '', status: 'all', service: 'all' };
      dom.rowSearch.value = '';
      dom.statusFilter.value = 'all';
      dom.serviceFilter.value = 'all';
      refresh({ renderRows: true });
    });
    dom.showInvalidButton.addEventListener('click', () => {
      state.filters.status = 'critical';
      dom.statusFilter.value = 'critical';
      refresh({ renderRows: true });
    });

    dom.selectAllRows.addEventListener('change', () => {
      const visibleIds = new Set(filteredRows().map((row) => row.id));
      state.rows.forEach((row) => { if (visibleIds.has(row.id)) row.selected = dom.selectAllRows.checked; });
      refresh({ renderRows: true });
    });
    dom.duplicateSelectedButton.addEventListener('click', () => duplicateRows(state.rows.filter((row) => row.selected)));
    dom.deleteSelectedButton.addEventListener('click', async () => {
      const selected = state.rows.filter((row) => row.selected);
      if (!selected.length) return;
      if (await confirmAction('Hapus baris terpilih?', `${selected.length} baris tarif terpilih akan dihapus.`, 'Hapus Baris')) deleteRows(selected.map((row) => row.id));
    });

    dom.tariffTableBody.addEventListener('input', (event) => {
      const field = event.target.dataset.field;
      if (!field) return;
      const tr = event.target.closest('tr[data-row-id]');
      const row = state.rows.find((item) => item.id === tr.dataset.rowId);
      if (!row) return;
      row[field] = event.target.type === 'number' ? event.target.value : event.target.value;
      if (['origin', 'destination', 'minimumTariff', 'description'].includes(field)) {
        row.importNeedsReview = false;
        row.importReviewMessage = '';
      }
      clearGenerated();
      refresh({ rowId: row.id });
    });
    dom.tariffTableBody.addEventListener('change', (event) => {
      const tr = event.target.closest('tr[data-row-id]');
      if (!tr) return;
      const row = state.rows.find((item) => item.id === tr.dataset.rowId);
      if (!row) return;
      if (event.target.dataset.field === 'serviceId') {
        row.serviceId = Number(event.target.value);
        clearGenerated();
        refresh({ rowId: row.id });
      } else if (event.target.dataset.field === 'formulaIdOverride') {
        row.formulaIdOverride = event.target.value;
        clearGenerated();
        refresh({ rowId: row.id });
      } else if (event.target.dataset.action === 'select') {
        row.selected = event.target.checked;
        refresh({ rowId: row.id });
      }
    });
    dom.tariffTableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const tr = button.closest('tr[data-row-id]');
      const row = state.rows.find((item) => item.id === tr.dataset.rowId);
      if (!row) return;
      if (button.dataset.action === 'expand') {
        row.expanded = !row.expanded;
        refresh({ rowId: row.id });
      } else if (button.dataset.action === 'duplicate') duplicateRows([row]);
      else if (button.dataset.action === 'delete') {
        const hasData = row.origin || row.destination || row.minimumTariff !== '' || row.description;
        if (!hasData || await confirmAction('Hapus baris tarif?', 'Rute tarif ini akan dihapus dari ruang kerja.', 'Hapus Baris')) deleteRows([row.id]);
      }
    });

    dom.exportButton.addEventListener('click', openExportDialog);
    dom.exportDialog.addEventListener('close', () => {
      if (dom.exportDialog.returnValue === 'confirm') performExport();
    });
    dom.downloadAgainButton.addEventListener('click', downloadAgain);
  }

  function initialize() {
    cacheDom();
    if (dom.appVersion) dom.appVersion.textContent = `Versi ${T.APP_VERSION}`;
    renderServiceOptions();
    bindGlobalEvents();
    state.validation = T.validateWorkspace(getGlobalValues(), state.rows);
    renderRows();
    refresh();
    if (!root.XLSX) {
      setImportMessage('SheetJS tidak dapat dimuat. Periksa koneksi internet lalu muat ulang halaman.', 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})(window);
