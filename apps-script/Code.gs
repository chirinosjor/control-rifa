const SPREADSHEET_ID = '1GGylbSh4UNN-r8TmV9iX61TJgosqIT0RqL963pc4l5s'; // Control rifa 2026

function doGet(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetNames = ss.getSheets()
    .map(sheet => sheet.getName())
    .filter(name => /^\d+\s+.+/.test(name));

  const payload = { result: 'success', sheets: sheetNames };

  // JSONP: Apps Script doesn't send CORS headers on doGet, so a plain
  // fetch() from the Vue app gets blocked by the browser. A <script>
  // tag isn't subject to CORS, so we support wrapping the JSON in a
  // callback when one is requested.
  const callback = e.parameter.callback;
  if (callback && /^[a-zA-Z0-9_]+$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonResponse(payload);
}

function doPost(e) {
  return handleSubmission(e);
}

function handleSubmission(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = e.parameter.sheetName;
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return jsonResponse({ result: 'error', message: 'La hoja seleccionada no existe: ' + sheetName });
  }

  if (!e.parameter.sheetName || !e.parameter.dateOfPayment || !e.parameter.amount || !e.parameter.quantity) {
    return jsonResponse({ result: 'error', message: 'Faltan datos, no se agregó nada' });
  }

  const match = sheetName.match(/^(\d+)\s+(.+)$/);
  const numero = match ? match[1] : '';
  const nombre = match ? match[2] : sheetName;

  let formattedDate = '';
  const rawDate = e.parameter.dateOfPayment;
  if (rawDate) {
    const parts = rawDate.split('-');
    if (parts.length === 3) {
      const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      formattedDate = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    }
  }

  const referencia = e.parameter.reference || '';
  const monto = parseFloat(e.parameter.amount) || 0;
  const cantidad = parseFloat(e.parameter.quantity) || 0;

  const newRow = [
    nombre, numero, formattedDate, referencia,
    monto, cantidad, false, new Date()
  ];

  const lastRow = sheet.getLastRow();
  const nombreValues = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1).getValues() : [];

  let totalRowIndex = -1;
  for (let i = 0; i < nombreValues.length; i++) {
    if (String(nombreValues[i][0]).trim().toLowerCase() === 'total') {
      totalRowIndex = i + 2; // +2: 1-indexed rows + header offset
      break;
    }
  }

  const insertRow = totalRowIndex !== -1 ? totalRowIndex : lastRow + 1;
  if (totalRowIndex !== -1) sheet.insertRowBefore(insertRow);

  sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);
  sheet.getRange(insertRow, 5).setNumberFormat('#,##0.00'); // columna E = Monto, ej. 1.200,00
  sheet.getRange(insertRow, 6).setNumberFormat('0.#'); // columna F = Cant. Nums, ej. 3,5 (o 1 sin decimales)
  setCheckbox(sheet, insertRow);

  return jsonResponse({ result: 'success', sheet: sheet.getName() });
}

function setCheckbox(sheet, row) {
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build();
  sheet.getRange(row, 7).setDataValidation(rule); // columna G = Verificado
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
