import { Case } from '../models/Case.js';
import { OverlapGroup } from '../models/OverlapGroup.js';
import { Bureau } from '../models/Bureau.js';
import { Institution } from '../models/Institution.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const now = new Date();

    // Regional officer filter if applicable
    const filter = {};
    const overlapFilter = { status: 'open' };

    if (req.user?.role === 'regional_officer' && req.user?.region) {
      const institutionsInRegion = await Institution.find({ region: req.user.region }).select('_id');
      const instIds = institutionsInRegion.map((i) => i._id);
      filter.institution = { $in: instIds };
      overlapFilter.institution = { $in: instIds };
    }

    const [
      totalReceived,
      pending,
      underProcess,
      needsInfo,
      disposed,
      transferred,
      escalated,
      rejected,
      beyondTimeline,
      activeOverlaps,
    ] = await Promise.all([
      Case.countDocuments(filter),
      Case.countDocuments({ ...filter, status: 'pending' }),
      Case.countDocuments({ ...filter, status: 'under_process' }),
      Case.countDocuments({ ...filter, status: 'needs_info' }),
      Case.countDocuments({ ...filter, status: 'disposed' }),
      Case.countDocuments({ ...filter, status: 'transferred' }),
      Case.countDocuments({ ...filter, status: 'escalated' }),
      Case.countDocuments({ ...filter, status: 'rejected' }),
      Case.countDocuments({
        ...filter,
        status: { $in: ['pending', 'under_process', 'needs_info', 'transferred', 'escalated'] },
        expectedDisposalDate: { $lt: now },
      }),
      OverlapGroup.countDocuments(overlapFilter),
    ]);

    const totalCases = totalReceived;
    const openCases = pending + underProcess + needsInfo + transferred + escalated;
    const disposalRate = totalReceived > 0 ? ((disposed / totalReceived) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        totalReceived,
        totalCases,
        openCases,
        pending,
        underProcess,
        needsInfo,
        disposed,
        transferred,
        escalated,
        rejected,
        beyondTimeline,
        activeOverlaps,
        disposalRate: `${disposalRate}%`,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBureauWorkload = async (req, res, next) => {
  try {
    const bureaus = await Bureau.find().select('name code type');

    const caseFilter = {};
    if (req.user?.role === 'regional_officer' && req.user?.region) {
      const institutionsInRegion = await Institution.find({ region: req.user.region }).select('_id');
      caseFilter.institution = { $in: institutionsInRegion.map((i) => i._id) };
    }

    const cases = await Case.find(caseFilter).populate('currentBureau', 'code name');

    const workload = bureaus.map((b) => {
      const bureauCases = cases.filter(
        (c) => c.currentBureau && c.currentBureau._id.toString() === b._id.toString()
      );

      const statusMap = {
        pending: 0,
        under_process: 0,
        needs_info: 0,
        disposed: 0,
        transferred: 0,
        escalated: 0,
        rejected: 0,
      };

      bureauCases.forEach((c) => {
        if (statusMap[c.status] !== undefined) {
          statusMap[c.status]++;
        }
      });

      return {
        id: b._id,
        code: b.code,
        name: b.name,
        type: b.type,
        total: bureauCases.length,
        ...statusMap,
      };
    });

    res.json({ success: true, data: workload });
  } catch (error) {
    next(error);
  }
};

export const getInstitutionStatus = async (req, res, next) => {
  try {
    const matchStage = { institution: { $ne: null } };

    if (req.user?.role === 'regional_officer' && req.user?.region) {
      const institutionsInRegion = await Institution.find({ region: req.user.region }).select('_id');
      matchStage.institution = { $in: institutionsInRegion.map((i) => i._id) };
    }

    const topInstitutions = await Case.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$institution',
          totalCases: { $sum: 1 },
          openCases: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'under_process', 'needs_info', 'transferred', 'escalated']] }, 1, 0],
            },
          },
          disposedCases: {
            $sum: { $cond: [{ $eq: ['$status', 'disposed'] }, 1, 0] },
          },
        },
      },
      { $sort: { totalCases: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'institutions',
          localField: '_id',
          foreignField: '_id',
          as: 'details',
        },
      },
      { $unwind: '$details' },
    ]);

    // Check overlap status for each
    const results = await Promise.all(
      topInstitutions.map(async (item) => {
        const overlap = await OverlapGroup.findOne({
          institution: item._id,
          status: 'open',
        });
        return {
          id: item._id,
          name: item.details.name,
          aicteId: item.details.aictePermanentId,
          region: item.details.region,
          city: item.details.city,
          state: item.details.state,
          totalCases: item.totalCases,
          openCases: item.openCases,
          disposedCases: item.disposedCases,
          hasOverlap: Boolean(overlap),
          overlapSeverity: overlap ? overlap.severity : null,
        };
      })
    );

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

/**
 * Bureau Dashboard KPI summary (for logged-in bureau officer / data operator's bureau)
 * GET /api/bureau/dashboard
 */

export const getMonthlyComplaintTrends = async (req, res, next) => {
  try {
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - 5,
      1
    );

    const filter = {
      $or: [
        { receivedDate: { $gte: startDate } },
        { disposedDate: { $gte: startDate } },
      ],
    };

    // Preserve the regional officer's existing data restrictions.
    if (req.user?.role === 'regional_officer' && req.user?.region) {
      const institutionsInRegion = await Institution.find({
        region: req.user.region,
      }).select('_id');

      filter.institution = {
        $in: institutionsInRegion.map((institution) => institution._id),
      };
    }

    const cases = await Case.find(filter)
      .select('receivedDate disposedDate status')
      .lean();

    const months = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      months.push({
        month: date.toLocaleString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        received: 0,
        resolved: 0,
      });
    }

    const monthMap = new Map(
      months.map((month) => [
        `${month.year}-${month.month}`,
        month,
      ])
    );

    const getMonthKey = (value) => {
      const date = new Date(value);
      const month = date.toLocaleString('en-US', { month: 'short' });
      return `${date.getFullYear()}-${month}`;
    };

    for (const complaint of cases) {
      const receivedMonth = monthMap.get(
        getMonthKey(complaint.receivedDate)
      );

      if (receivedMonth) {
        receivedMonth.received++;
      }

      if (complaint.status === 'disposed' && complaint.disposedDate) {
        const resolvedMonth = monthMap.get(
          getMonthKey(complaint.disposedDate)
        );

        if (resolvedMonth) {
          resolvedMonth.resolved++;
        }
      }
    }

    res.json({
      success: true,
      data: months.map(({ month, year, received, resolved }) => ({
        month: `${month} ${year}`,
        received,
        resolved,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getBureauDashboard = async (req, res, next) => {
  try {
    const userBureauId = req.user?.bureau?._id
      ? req.user.bureau._id.toString()
      : req.user?.bureau?.toString();

    if (!userBureauId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: User is not associated with any bureau.',
      });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const bureauFilter = { currentBureau: userBureauId };

    const [
      assigned,
      pending,
      underProcess,
      needsInfo,
      disposed,
      rejected,
      overdue,
      openCasesForDueSoon,
      doneThisMonth,
    ] = await Promise.all([
      Case.countDocuments(bureauFilter),
      Case.countDocuments({ ...bureauFilter, status: 'pending' }),
      Case.countDocuments({ ...bureauFilter, status: 'under_process' }),
      Case.countDocuments({ ...bureauFilter, status: 'needs_info' }),
      Case.countDocuments({ ...bureauFilter, status: 'disposed' }),
      Case.countDocuments({ ...bureauFilter, status: 'rejected' }),
      Case.countDocuments({
        ...bureauFilter,
        status: { $nin: ['disposed', 'rejected'] },
        expectedDisposalDate: { $lt: now },
      }),
      Case.find({
        ...bureauFilter,
        status: { $nin: ['disposed', 'rejected'] },
        expectedDisposalDate: { $gte: now },
      }).select('expectedDisposalDate'),
      Case.countDocuments({
        ...bureauFilter,
        status: 'disposed',
        disposedDate: { $gte: startOfMonth },
      }),
    ]);

    const dueSoon = openCasesForDueSoon.filter((c) => {
      const diff = new Date(c.expectedDisposalDate).getTime() - now.getTime();
      return diff <= 3 * 24 * 60 * 60 * 1000;
    }).length;

    res.json({
      success: true,
      data: {
        assigned,
        pending,
        inProgress: underProcess,
        underProcess,
        needsInfo,
        disposed,
        rejected,
        overdue,
        dueSoon,
        doneThisMonth,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getDashboardSummary,
  getBureauWorkload,
  getInstitutionStatus,
  getBureauDashboard,
  getMonthlyComplaintTrends,
};
