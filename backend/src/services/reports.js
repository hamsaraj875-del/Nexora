import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { Case } from '../models/Case.js';
import { Institution } from '../models/Institution.js';
import { Bureau } from '../models/Bureau.js';
import { OverlapGroup } from '../models/OverlapGroup.js';

export const generateReportData = async (type, options = {}) => {
  const now = new Date();
  const user = options.user;

  // Base scope filter
  const caseFilter = {};
  let regionInstIds = null;

  if (user?.role === 'regional_officer' && user?.region) {
    const regionInsts = await Institution.find({ region: user.region }).select('_id');
    regionInstIds = regionInsts.map((i) => i._id);
    caseFilter.institution = { $in: regionInstIds };
  }

  // Date filters if provided
  if (options.dateFrom || options.dateTo) {
    caseFilter.receivedDate = {};
    if (options.dateFrom) caseFilter.receivedDate.$gte = new Date(options.dateFrom);
    if (options.dateTo) caseFilter.receivedDate.$lte = new Date(options.dateTo);
  }

  switch (type) {
    case 'bureau': {
      // Workload by bureau and status
      const matchCriteria = { ...caseFilter };
      const pipeline = [
        ...(Object.keys(matchCriteria).length > 0 ? [{ $match: matchCriteria }] : []),
        {
          $lookup: {
            from: 'bureaus',
            localField: 'currentBureau',
            foreignField: '_id',
            as: 'bureauInfo',
          },
        },
        { $unwind: { path: '$bureauInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              bureauName: { $ifNull: ['$bureauInfo.name', 'Unassigned'] },
              bureauCode: { $ifNull: ['$bureauInfo.code', 'UNASSIGNED'] },
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.bureauCode',
            name: { $first: '$_id.bureauName' },
            statuses: {
              $push: { status: '$_id.status', count: '$count' },
            },
            total: { $sum: '$count' },
          },
        },
        { $sort: { total: -1 } },
      ];

      const data = await Case.aggregate(pipeline);
      return data;
    }

    case 'region': {
      // Region-wise case counts
      const matchCriteria = { ...caseFilter };
      const data = await Case.aggregate([
        ...(Object.keys(matchCriteria).length > 0 ? [{ $match: matchCriteria }] : []),
        {
          $lookup: {
            from: 'institutions',
            localField: 'institution',
            foreignField: '_id',
            as: 'instInfo',
          },
        },
        { $unwind: { path: '$instInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$instInfo.region', 'Unknown Region'] },
            totalCases: { $sum: 1 },
            pendingCases: {
              $sum: { $cond: [{ $in: ['$status', ['pending', 'under_process', 'needs_info']] }, 1, 0] },
            },
            disposedCases: {
              $sum: { $cond: [{ $eq: ['$status', 'disposed'] }, 1, 0] },
            },
            escalatedCases: {
              $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] },
            },
          },
        },
        { $sort: { totalCases: -1 } },
      ]);
      return data;
    }

    case 'ageing': {
      // Buckets: 0-15, 16-30, 31-60, 60+
      const openCases = await Case.find({
        ...caseFilter,
        status: { $in: ['pending', 'under_process', 'needs_info', 'transferred', 'escalated'] },
      }).select('caseId rawInstitutionName category receivedDate status expectedDisposalDate');

      const buckets = {
        '0-15 days': 0,
        '16-30 days': 0,
        '31-60 days': 0,
        '60+ days': 0,
      };

      const detailedList = openCases.map((c) => {
        const days = Math.floor((now.getTime() - new Date(c.receivedDate).getTime()) / (1000 * 60 * 60 * 24));
        let bucket = '60+ days';
        if (days <= 15) bucket = '0-15 days';
        else if (days <= 30) bucket = '16-30 days';
        else if (days <= 60) bucket = '31-60 days';

        buckets[bucket]++;
        return {
          caseId: c.caseId,
          institution: c.rawInstitutionName,
          category: c.category,
          status: c.status,
          ageInDays: Math.max(0, days),
          bucket,
        };
      });

      return {
        summary: Object.entries(buckets).map(([name, count]) => ({ name, count })),
        cases: detailedList,
      };
    }

    case 'disposal-rate': {
      // Overall and by category disposal rate
      const totalReceived = await Case.countDocuments(caseFilter);
      const totalDisposed = await Case.countDocuments({ ...caseFilter, status: 'disposed' });
      const overallRate = totalReceived > 0 ? ((totalDisposed / totalReceived) * 100).toFixed(1) : '0.0';

      const byCategory = await Case.aggregate([
        ...(Object.keys(caseFilter).length > 0 ? [{ $match: caseFilter }] : []),
        {
          $group: {
            _id: '$category',
            received: { $sum: 1 },
            disposed: {
              $sum: { $cond: [{ $eq: ['$status', 'disposed'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            category: '$_id',
            received: 1,
            disposed: 1,
            rate: {
              $cond: [
                { $gt: ['$received', 0] },
                { $round: [{ $multiply: [{ $divide: ['$disposed', '$received'] }, 100] }, 1] },
                0,
              ],
            },
          },
        },
        { $sort: { received: -1 } },
      ]);

      return {
        totalReceived,
        totalDisposed,
        overallRate: `${overallRate}%`,
        byCategory,
      };
    }

    case 'overlaps': {
      const overlapQuery = {};
      if (regionInstIds) {
        overlapQuery.institution = { $in: regionInstIds };
      }

      const groups = await OverlapGroup.find(overlapQuery)
        .populate('institution')
        .populate({
          path: 'cases',
          populate: { path: 'currentBureau' },
        })
        .populate('resolvedBy', 'name email');

      return groups;
    }

    case 'institution': {
      const instQuery = {};
      if (user?.role === 'regional_officer' && user?.region) {
        instQuery.region = user.region;
      }

      const list = await Institution.find(instQuery).limit(100);
      const results = [];
      for (const inst of list) {
        const totalCases = await Case.countDocuments({ institution: inst._id });
        const openCases = await Case.countDocuments({
          institution: inst._id,
          status: { $in: ['pending', 'under_process', 'needs_info', 'transferred', 'escalated'] },
        });
        const hasOverlap = await OverlapGroup.exists({
          institution: inst._id,
          status: 'open',
        });
        results.push({
          aictePermanentId: inst.aictePermanentId,
          name: inst.name,
          city: inst.city,
          state: inst.state,
          region: inst.region,
          totalCases,
          openCases,
          hasOverlap: Boolean(hasOverlap),
        });
      }
      return results;
    }

    default:
      return { message: `Report type '${type}' generated`, timestamp: new Date() };
  }
};

/**
 * Format report data to clean, structured CSV rows
 */
export const formatReportCSV = (type, data) => {
  let items = [];

  switch (type) {
    case 'bureau': {
      if (Array.isArray(data)) {
        items = data.map((b) => {
          const row = {
            'Bureau Code': b._id,
            'Bureau Name': b.name,
            'Total Cases': b.total,
          };
          (b.statuses || []).forEach((st) => {
            row[st.status] = st.count;
          });
          return row;
        });
      }
      break;
    }

    case 'region': {
      if (Array.isArray(data)) {
        items = data.map((r) => ({
          Region: r._id,
          'Total Cases': r.totalCases,
          'Pending Cases': r.pendingCases,
          'Disposed Cases': r.disposedCases,
          'Escalated Cases': r.escalatedCases,
        }));
      }
      break;
    }

    case 'ageing': {
      items = data?.cases || [];
      break;
    }

    case 'disposal-rate': {
      items = (data?.byCategory || []).map((cat) => ({
        Category: cat.category,
        Received: cat.received,
        Disposed: cat.disposed,
        'Disposal Rate (%)': cat.rate,
      }));
      break;
    }

    case 'overlaps': {
      if (Array.isArray(data)) {
        items = data.map((og) => ({
          'Institution Name': og.institution?.name || 'N/A',
          'AICTE ID': og.institution?.aictePermanentId || 'N/A',
          Region: og.institution?.region || 'N/A',
          'Overlap Type': og.overlapType || 'coordination_required',
          Severity: og.severity,
          Status: og.status,
          Reason: og.reason || '',
          'Case Count': og.cases?.length || 0,
          'Case IDs': (og.cases || []).map((c) => c.caseId || c._id).join('; '),
          'Resolved By': og.resolvedBy?.name || '',
          'Resolution Remarks': og.resolutionRemarks || '',
        }));
      }
      break;
    }

    case 'institution': {
      items = Array.isArray(data) ? data : [];
      break;
    }

    default: {
      items = Array.isArray(data) ? data : [data];
    }
  }

  const parser = new Parser({ flatten: true });
  return parser.parse(items);
};

/**
 * Format report data to PDF stream
 */
export const formatReportPDF = (type, data, res) => {
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  // Header
  doc.fontSize(18).text('AICTE Complaint Monitoring System', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(14).text(`Statutory Report: ${type.toUpperCase()}`, { align: 'center' });
  doc.fontSize(9).fillColor('gray').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(0.8);
  doc.fillColor('black');

  doc.fontSize(10).text(JSON.stringify(data, null, 2), {
    width: 500,
    align: 'left',
  });

  doc.end();
};
