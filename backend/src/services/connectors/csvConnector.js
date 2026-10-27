import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

/**
 * Parse CSV or Excel file buffer into standardized row objects
 */
export const parseUploadFile = async (fileBuffer, originalname) => {
  const lowerName = (originalname || '').toLowerCase();
  if (lowerName.endsWith('.xls')) {
    throw new Error('Legacy Excel (.xls) binary files are not supported. Please convert and upload as .xlsx or .csv.');
  }

  const isExcel = lowerName.endsWith('.xlsx');

  if (isExcel) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.worksheets[0];

    const rows = [];
    const headers = [];

    worksheet.eachRow((row, rowNumber) => {
      const values = row.values.slice(1); // 1-indexed in exceljs
      if (rowNumber === 1) {
        values.forEach((v) => headers.push(String(v || '').trim()));
      } else {
        const rowData = {};
        headers.forEach((h, idx) => {
          rowData[h] = values[idx] !== undefined ? String(values[idx]).trim() : '';
        });
        rows.push(rowData);
      }
    });

    return mapRawRows(rows);
  } else {
    const content = fileBuffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return mapRawRows(records);
  }
};

const mapRawRows = (rows) => {
  return rows.map((r, index) => {
    // Accommodate flexible column names
    const sourceCaseRef = r.CaseID || r.ComplaintNo || r.GrievanceId || r.ReferenceNo || `CSV-ROW-${index + 1}`;
    const rawInstitutionName = r.InstitutionName || r.CollegeName || r.Institute || r.Name || '';
    const aictePermanentId = r.AICTE_Permanent_ID || r.PermanentId || r.InstituteId || r.AicteId || '';
    const rawCity = r.City || r.CampusCity || r.Place || '';
    const rawState = r.State || '';
    const rawDistrict = r.District || '';
    const rawPincode = r.Pincode || r.Pin || '';
    const category = r.Category || r.ComplaintType || 'General Grievance';
    const description = r.Description || r.Details || r.Summary || 'No details provided';
    const complainantType = r.ComplainantType || r.FiledBy || 'Student';
    const receivedDate = r.ReceivedDate || r.Date || new Date().toISOString();
    const status = r.Status || 'pending';
    const sourceSystem = r.SourceBureau || r.Source || 'CSV_UPLOAD';

    return {
      sourceSystem,
      sourceCaseRef,
      aictePermanentId,
      rawInstitutionName,
      rawAddress: r.Address || '',
      rawCity,
      rawDistrict,
      rawState,
      rawPincode,
      category,
      description,
      complainantType,
      receivedDate,
      status,
      lastActionText: r.LastAction || 'Imported via CSV/Excel',
    };
  });
};
