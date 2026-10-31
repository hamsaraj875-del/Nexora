
import { Case } from '../models/Case.js';
import { Institution } from '../models/Institution.js';
import { CaseAction } from '../models/CaseAction.js';
import { matchInstitution } from '../services/matcher.js';
import { checkInstitutionOverlap } from '../services/overlap.js';

export const getMatchReviewQueue = async (req, res, next) => {
  try {
    const status = req.query.status;

    const allowedStatuses = ['review', 'matched', 'unmatched'];

    const query = {
      matchStatus: allowedStatuses.includes(status)
        ? status
        : { $in: allowedStatuses },
    };

    // Bureau officers and data operators see only their own bureau cases.
    if (
      ['bureau_officer', 'data_operator'].includes(req.user?.role) &&
      req.user?.bureau
    ) {
      const bureauId = req.user.bureau._id || req.user.bureau;
      query.currentBureau = bureauId;
    }

    // Regional officer restriction.
    if (req.user?.role === 'regional_officer' && req.user?.region) {
      const regionInsts = await Institution.find({
        region: req.user.region,
      }).select('_id');

      query.$or = [
        { institution: { $in: regionInsts.map((i) => i._id) } },
        { rawState: new RegExp(req.user.region, 'i') },
      ];
    }

    const cases = await Case.find(query)
      .populate('currentBureau', 'code name')
      .populate('institution', 'name aictePermanentId city state region')
      .sort({ createdAt: -1 })
      .limit(50);

    const enriched = await Promise.all(
      cases.map(async (c) => {
        const matchResult = await matchInstitution({
          aictePermanentId: undefined,
          rawInstitutionName: c.rawInstitutionName,
          rawCity: c.rawCity,
          rawDistrict: c.rawDistrict,
          rawState: c.rawState,
          rawPincode: c.rawPincode,
        });

        return {
          case: c,
          currentScore: c.matchScore,
          matchStatus: c.matchStatus,
          suggestions: matchResult.candidates || [],
        };
      })
    );

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmMatch = async (req, res, next) => {
  try {
    if (req.user?.role === 'senior_management') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Senior Management has read-only access.',
      });
    }

    const { caseId } = req.params;
    const { institutionId, remarks } = req.body;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: 'institutionId is required.',
      });
    }

    const c = await Case.findById(caseId);

    if (!c) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }

    // Prevent bureau users from confirming another bureau's case.
    if (
      ['bureau_officer', 'data_operator'].includes(req.user?.role)
    ) {
      const userBureauId = req.user?.bureau?._id || req.user?.bureau;

      if (
        !userBureauId ||
        String(c.currentBureau) !== String(userBureauId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'You cannot confirm another bureau’s case.',
        });
      }
    }

    const institution = await Institution.findById(institutionId);

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: 'Institution not found',
      });
    }

    const oldInstitutionId = c.institution
      ? c.institution.toString()
      : null;

    c.institution = institution._id;
    c.matchStatus = 'matched';
    c.matchScore = 100;
    c.lastActionText =
      `Institution manually matched and confirmed: ${institution.name}`;
    c.lastActionDate = new Date();

    await c.save();

    await CaseAction.create({
      case: c._id,
      actionType: 'remark',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks:
        `Manual Institution Match: Confirmed link to ${institution.name} ` +
        `(AICTE Permanent ID: ${institution.aictePermanentId}). ${remarks || ''}`,
      timestamp: new Date(),
    });

    await checkInstitutionOverlap(institution._id);

    if (
      oldInstitutionId &&
      oldInstitutionId !== institution._id.toString()
    ) {
      await checkInstitutionOverlap(oldInstitutionId);
    }

    res.json({
      success: true,
      message: `Case ${c.caseId} successfully matched to ${institution.name}`,
      data: c,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectMatch = async (req, res, next) => {
  try {
    if (req.user?.role === 'senior_management') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Senior Management has read-only access.',
      });
    }

    const { caseId } = req.params;
    const { remarks } = req.body;

    const c = await Case.findById(caseId);

    if (!c) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }

    // Prevent bureau users from rejecting another bureau's case.
    if (
      ['bureau_officer', 'data_operator'].includes(req.user?.role)
    ) {
      const userBureauId = req.user?.bureau?._id || req.user?.bureau;

      if (
        !userBureauId ||
        String(c.currentBureau) !== String(userBureauId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'You cannot reject another bureau’s case.',
        });
      }
    }

    const oldInstitutionId = c.institution
      ? c.institution.toString()
      : null;

    c.institution = undefined;
    c.matchStatus = 'unmatched';
    c.matchScore = 0;
    c.lastActionText =
      `Institution match rejected by operator: ${remarks || 'Unmatched'}`;
    c.lastActionDate = new Date();

    await c.save();

    await CaseAction.create({
      case: c._id,
      actionType: 'remark',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks:
        `Institution match rejected: ${remarks || 'Marked as unmatched for physical registry review'}`,
      timestamp: new Date(),
    });

    if (oldInstitutionId) {
      await checkInstitutionOverlap(oldInstitutionId);
    }

    res.json({
      success: true,
      message: `Case ${c.caseId} marked as unmatched.`,
      data: c,
    });
  } catch (error) {
    next(error);
  }
};
