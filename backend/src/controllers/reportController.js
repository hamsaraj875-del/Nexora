import {
  generateReportData,
  formatReportCSV,
  formatReportPDF,
} from '../services/reports.js';

export const getReport = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { format = 'json', period, dateFrom, dateTo } = req.query;

    const data = await generateReportData(type, {
      period,
      dateFrom,
      dateTo,
      user: req.user,
    });

    if (format === 'csv') {
      const csv = formatReportCSV(type, data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="aicte_report_${type}_${Date.now()}.csv"`);
      return res.send(csv);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="aicte_report_${type}_${Date.now()}.pdf"`);
      return formatReportPDF(type, data, res);
    }

    res.json({ success: true, type, data });
  } catch (error) {
    next(error);
  }
};
