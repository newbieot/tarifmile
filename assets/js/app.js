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
      'confirmDialogAction', 'exportDialog', 'exportConfirmGrid', 'confirmExportButton'
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
    select.setAttribute('aria-label', `Service for route ${row.id}`);
    T.SERVICES.forEach((service) => {
      const option = document.createElement('option');
      option.value = String(service.id);
      option.textContent = `${service.name} · ${service.id}`;
      option.selected = Number(row.serviceId) === service.id;
      select.appendChild(option);
    });
    return select;
  }

  function createInput(row, field, type, attributes) {
    const input = document.createElement('input');
    input.type = type;
    input.dataset.field = field;
    input.value = row[field] ?? '';
    input.setAttribute('aria-label', `${field.replace(/([A-Z])/g, ' $1')} for route ${row.id}`);
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
    route.textContent = `${row.origin || 'Origin'} → ${row.destination || 'Destination'}`;
    const meta = document.createElement('span');
    meta.className = 'mobile-meta';
    const serviceText = document.createElement('span');
    serviceText.textContent = T.getServiceLabel(row.serviceId);
    const tariffText = document.createElement('span');
    tariffText.textContent = row.minimumTariff === '' ? 'Tariff incomplete' : `Rp ${Number(row.minimumTariff).toLocaleString('id-ID')}`;
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
    expand.setAttribute('aria-label', row.expanded ? 'Collapse tariff route' : 'Expand tariff route');
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
    selectBox.setAttribute('aria-label', `Select tariff route ${rowIndex + 1}`);
    tr.appendChild(createCell('Select', selectBox));

    const rowNumber = document.createElement('span');
    rowNumber.className = 'row-number';
    rowNumber.textContent = String(rowIndex + 1);
    tr.appendChild(createCell('Number', rowNumber));

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

    tr.appendChild(createCell('Origin', createInput(row, 'origin', 'text', { placeholder: '29400', inputmode: 'text', maxlength: '12', spellcheck: 'false' }), 'origin'));
    tr.appendChild(createCell('Destination', createInput(row, 'destination', 'text', { placeholder: '10110', inputmode: 'text', maxlength: '12', spellcheck: 'false' }), 'destination'));
    tr.appendChild(createCell('Service', createServiceSelect(row), 'serviceId'));

    const sla = T.getSla(row.serviceId);
    const slaBox = document.createElement('div');
    slaBox.className = 'sla-display';
    const slaDays = document.createElement('strong');
    slaDays.textContent = `${sla.days} days`;
    const slaHours = document.createElement('small');
    slaHours.textContent = `${sla.hours} hours`;
    slaBox.append(slaDays, slaHours);
    tr.appendChild(createCell('SLA', slaBox));

    tr.appendChild(createCell('Minimum Weight', createInput(row, 'minimumWeight', 'number', { min: '1', step: '1', inputmode: 'numeric' }), 'minimumWeight'));
    tr.appendChild(createCell('Minimum Tariff', createInput(row, 'minimumTariff', 'number', { min: '0', step: '1', inputmode: 'decimal', placeholder: '0' }), 'minimumTariff'));
    tr.appendChild(createCell('Increment Weight', createInput(row, 'incrementWeight', 'number', { min: '1', step: '1', inputmode: 'numeric' }), 'incrementWeight'));
    tr.appendChild(createCell('Increment Tariff', createInput(row, 'incrementTariff', 'number', { min: '0', step: '1', inputmode: 'decimal', placeholder: '0' }), 'incrementTariff'));
    tr.appendChild(createCell('Description', createInput(row, 'description', 'text', { placeholder: 'Tariff description', spellcheck: 'false' }), 'description'));

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const duplicate = document.createElement('button');
    duplicate.type = 'button';
    duplicate.className = 'icon-button';
    duplicate.dataset.action = 'duplicate';
    duplicate.setAttribute('aria-label', `Duplicate tariff route ${rowIndex + 1}`);
    duplicate.title = 'Duplicate row';
    duplicate.appendChild(svg(['M8 8h11v11H8z', 'M5 16H4V5h11v1']));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-button icon-button--danger';
    remove.dataset.action = 'delete';
    remove.setAttribute('aria-label', `Delete tariff route ${rowIndex + 1}`);
    remove.title = 'Delete row';
    remove.appendChild(svg(['M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5']));
    actions.append(duplicate, remove);
    tr.appendChild(createCell('Actions', actions));

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
    const sla = T.getSla(row.serviceId);
    const slaBox = tr.querySelector('.sla-display');
    if (slaBox) {
      slaBox.querySelector('strong').textContent = `${sla.days} days`;
      slaBox.querySelector('small').textContent = `${sla.hours} hours`;
    }
    const mobileRoute = tr.querySelector('.mobile-route');
    if (mobileRoute) mobileRoute.textContent = `${row.origin || 'Origin'} → ${row.destination || 'Destination'}`;
    const mobileMeta = tr.querySelector('.mobile-meta');
    if (mobileMeta) {
      const spans = mobileMeta.querySelectorAll(':scope > span');
      if (spans[0]) spans[0].textContent = T.getServiceLabel(row.serviceId);
      if (spans[1]) spans[1].textContent = row.minimumTariff === '' ? 'Tariff incomplete' : `Rp ${Number(row.minimumTariff).toLocaleString('id-ID')}`;
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
      dom.setupCompletion.textContent = 'Customer setup complete';
      dom.setupCompletion.classList.add('is-complete');
    } else {
      dom.setupCompletion.textContent = `Complete ${result.remainingFields} required field${result.remainingFields === 1 ? '' : 's'}`;
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
    if (!counts.total) dom.validationSentence.textContent = 'Add a tariff route to continue.';
    else if (state.validation.exportable) dom.validationSentence.textContent = `${acceptable} of ${counts.total} tariff routes are ready for export.`;
    else if (counts.critical) dom.validationSentence.textContent = `${counts.critical} tariff route${counts.critical === 1 ? '' : 's'} must be corrected before export.`;
    else dom.validationSentence.textContent = `${acceptable} of ${counts.total} tariff routes are ready for review.`;
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
    dom.previewCount.textContent = `${records.length} ready row${records.length === 1 ? '' : 's'}`;
    const services = [...new Set(records.map((record) => String(record.service_id)))].join(', ') || '—';
    dom.previewGrid.replaceChildren(
      addPreviewItem('Customer ID', globalValues.customerId ? T.normalizeCustomerId(globalValues.customerId) : '—'),
      addPreviewItem('Salesforce', globalValues.salesforceNumber || '—'),
      addPreviewItem('Effective Period', globalValues.startDate && globalValues.endDate ? `${globalValues.startDate} → ${globalValues.endDate}` : '—'),
      addPreviewItem('Ready Routes', String(records.length)),
      addPreviewItem('Services', services),
      addPreviewItem('Worksheet', T.DEFAULTS.worksheetName)
    );

    const fragment = document.createDocumentFragment();
    records.slice(0, 100).forEach((record) => {
      const tr = document.createElement('tr');
      [
        record.tariff_from_code,
        record.tariff_to_code,
        String(record.service_id),
        `${record.tariff_sla_day} days · ${record.tariff_sla_hours} hours`,
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
    const filename = globalValues.salesforceNumber ? T.getOutputFilename(globalValues.salesforceNumber) : 'Tarif_Negotiable_<Salesforce Number>.xlsx';
    dom.exportFilename.textContent = `Output file: ${filename}`;
    dom.exportButton.disabled = !state.validation.exportable || state.processing || !root.XLSX;
    if (!root.XLSX) dom.exportHeadline.textContent = 'SheetJS is unavailable. Check the connection and reload the page.';
    else if (state.processing) dom.exportHeadline.textContent = 'Processing the selected workbook…';
    else if (state.validation.exportable) dom.exportHeadline.textContent = `${state.validation.readyCount} tariff route${state.validation.readyCount === 1 ? '' : 's'} ready for export.`;
    else dom.exportHeadline.textContent = 'Complete the customer setup and validate the tariff routes before exporting.';
    dom.downloadAgainButton.hidden = !state.generated;
  }

  function renderBulkToolbar() {
    const selected = state.rows.filter((row) => row.selected).length;
    dom.bulkToolbar.hidden = selected === 0;
    dom.selectedRowsText.textContent = `${selected} row${selected === 1 ? '' : 's'} selected`;
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
        minimumWeight: row.minimumWeight,
        minimumTariff: row.minimumTariff,
        incrementWeight: row.incrementWeight,
        incrementTariff: row.incrementTariff,
        description: row.description,
        importNeedsReview: true,
        importReviewMessage: 'Duplicated row. Change the route or resolve the duplicate warning.',
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
    showToast(`${newRows.length} tariff row${newRows.length === 1 ? '' : 's'} duplicated.`, 'warning');
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
      dom.confirmDialogAction.textContent = actionLabel || 'Continue';
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
    dom.selectedFileStatus.textContent = status || 'Ready to process';
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
    dom.importSummaryText.textContent = `${summary.routesImported} tariff route${summary.routesImported === 1 ? '' : 's'} imported. ${summary.duplicatesSkipped} duplicate${summary.duplicatesSkipped === 1 ? '' : 's'} and ${summary.emptyRowsSkipped} empty row${summary.emptyRowsSkipped === 1 ? '' : 's'} were skipped.${skipped === 0 ? ' No source rows were skipped.' : ''}`;
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
    renderFileCard(file, 'Waiting to process');
    setImportMessage('', '');
    setProgress('Reading workbook', 'Preparing the selected file…', true);
    refresh();

    try {
      const result = await T.readWorkbookFile(file, (title, detail) => setProgress(title, detail, true));
      setProgress('Validating data', 'Checking imported routes and tariff values…', true);
      state.rows = result.rows;
      state.rows[0].expanded = true;
      renderImportSummary(result.summary);
      renderFileCard(file, `${result.summary.routesImported} routes imported from ${result.sheetName}`);
      setImportMessage(`${result.summary.routesImported} tariff routes imported successfully. Review any highlighted rows before export.`, 'success');
      showToast('Tariff routes imported successfully.', 'success');
      announce(`${result.summary.routesImported} tariff routes imported.`);
    } catch (error) {
      setImportMessage(error && error.message ? error.message : 'The selected workbook could not be processed.', 'error');
      renderFileCard(file, 'Import failed');
      showToast(error && error.message ? error.message : 'Import failed.', 'error');
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
    showToast('Imported file reference removed. Edited tariff rows were kept.', 'success');
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
      ['Customer ID', T.normalizeCustomerId(globals.customerId)],
      ['Salesforce Number', globals.salesforceNumber],
      ['Effective Period', `${globals.startDate} → ${globals.endDate}`],
      ['Route Count', String(state.rows.length)],
      ['Valid Route Count', String(state.validation.readyCount)],
      ['Selected Services', serviceNames],
      ['Output Filename', T.getOutputFilename(globals.salesforceNumber)],
      ['Worksheet', T.DEFAULTS.worksheetName]
    ];
  }

  function openExportDialog() {
    refresh();
    if (!state.validation.exportable) {
      showToast('Resolve the customer and route validation errors before export.', 'error');
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
    setProgress('Preparing workbook', 'Creating the MILE-compatible XLSX file…', true);
    refresh();
    root.setTimeout(() => {
      try {
        const generated = T.generateAndDownload(getGlobalValues(), state.rows);
        state.generated = { blob: generated.blob, filename: generated.filename, createdAt: Date.now() };
        setProgress('Download ready', 'Workbook generated successfully.', true);
        showToast('Workbook generated successfully.', 'success');
        announce('Workbook generated successfully.');
      } catch (error) {
        showToast(error && error.message ? error.message : 'Workbook generation failed.', 'error');
        announce('Workbook generation failed.');
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
      showToast('Workbook download started again.', 'success');
    } catch (_) {
      showToast('The workbook could not be downloaded again. Generate a new workbook.', 'error');
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
      dom.toggleDuplicatesButton.textContent = dom.duplicateList.hidden ? 'View skipped routes' : 'Hide skipped routes';
    });

    dom.addRowButton.addEventListener('click', () => addRow());
    dom.resetRowsButton.addEventListener('click', async () => {
      const meaningful = state.rows.some((row) => row.origin || row.destination || row.minimumTariff !== '' || row.description);
      if (!meaningful || await confirmAction('Reset tariff rows?', 'All imported and manually edited tariff rows will be replaced with one blank row. Customer details will be kept.', 'Reset Rows')) resetRows();
    });
    dom.clearWorkspaceButton.addEventListener('click', async () => {
      const meaningful = state.rows.some((row) => row.origin || row.destination || row.minimumTariff !== '' || row.description) || Object.values(getGlobalValues()).some(Boolean);
      if (!meaningful || await confirmAction('Clear the workspace?', 'Customer details, the selected file, tariff rows, filters, messages, and generated workbook references will be cleared.', 'Clear Workspace')) clearWorkspace();
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
      if (await confirmAction('Delete selected rows?', `${selected.length} selected tariff row${selected.length === 1 ? '' : 's'} will be removed.`, 'Delete Rows')) deleteRows(selected.map((row) => row.id));
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
        if (!hasData || await confirmAction('Delete tariff row?', 'This tariff route will be removed from the workspace.', 'Delete Row')) deleteRows([row.id]);
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
    renderServiceOptions();
    bindGlobalEvents();
    state.validation = T.validateWorkspace(getGlobalValues(), state.rows);
    renderRows();
    refresh();
    if (!root.XLSX) {
      setImportMessage('SheetJS could not be loaded. Check your internet connection and reload the page.', 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})(window);
