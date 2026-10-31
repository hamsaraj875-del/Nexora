import { OverlapGroup } from '../models/OverlapGroup.js';
import { CaseAction } from '../models/CaseAction.js';
import { CaseLink } from '../models/CaseLink.js';
import { Case } from '../models/Case.js';
import { Institution } from '../models/Institution.js';
import { Alert } from '../models/Alert.js';
import { createOrUpdateAlert } from '../services/alerts.js';
import { OverlapExplanation } from '../models/OverlapExplanation.js';

export const getOverlaps = async (req, res, next) => {
  try {
    
    const { status = 'open', mine } = req.query;
    const query = {};

    if (status && status !== 'all') query.status = status;

    // Regional officer restriction: own region institutions only
    if (req.user?.role === 'regional_officer' && req.user?.region) {
      const regionInsts = await Institution.find({
        region: req.user.region,
      }).select('_id');

      query.institution = {
        $in: regionInsts.map((i) => i._id),
      };
    }

    // Bureau mine=true filter: only overlaps involving MY bureau's cases
    if (mine === 'true' && req.user?.bureau) {
      const userBureauId = req.user.bureau._id
        ? req.user.bureau._id
        : req.user.bureau;

      const myBureauCases = await Case.find({
        currentBureau: userBureauId,
      }).select('_id');

      

      query.cases = {
        $in: myBureauCases.map((c) => c._id),
      };
    }

    const overlaps = await OverlapGroup.find(query)
      .populate('institution')
      .populate({
        path: 'cases',
        populate: [
          { path: 'currentBureau', select: 'name code type' },
          { path: 'assignedOfficer', select: 'name email role' },
        ],
      })
      .populate({
        path: 'candidatePairs.caseA',
        select: 'caseId sourceSystem category description receivedDate currentBureau',
        populate: {
          path: 'currentBureau',
          select: 'name code type',
        },
      })
      .populate({
        path: 'candidatePairs.caseB',
        select: 'caseId sourceSystem category description receivedDate currentBureau',
        populate: {
          path: 'currentBureau',
          select: 'name code type',
        },
      })
      .populate('confirmedLinks')
      .populate('resolvedBy', 'name email role')
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: overlaps });
  } catch (error) {
    next(error);
  }
};

export const getOverlapById = async (req, res, next) => {
  try {
    const overlap = await OverlapGroup.findById(req.params.id)
      .populate('institution')
      .populate({
        path: 'cases',
        populate: [
          { path: 'currentBureau', select: 'name code type' },
          { path: 'assignedOfficer', select: 'name email role' },
        ],
      })
      .populate({
        path: 'candidatePairs.caseA',
        select: 'caseId sourceSystem category description receivedDate currentBureau',
        populate: {
          path: 'currentBureau',
          select: 'name code type',
        },
      })
      .populate({
        path: 'candidatePairs.caseB',
        select: 'caseId sourceSystem category description receivedDate currentBureau',
        populate: {
          path: 'currentBureau',
          select: 'name code type',
        },
      })
      .populate({
        path: 'confirmedLinks',
        populate: [
          { path: 'caseA', select: 'caseId category status currentBureau' },
          { path: 'caseB', select: 'caseId category status currentBureau' },
          { path: 'createdBy', select: 'name email' },
        ],
      })
      .populate('resolvedBy', 'name email role');

    if (!overlap) {
      return res.status(404).json({
        success: false,
        message: 'Overlap group not found',
      });
    }

    // Regional officer access check
    if (
      req.user?.role === 'regional_officer' &&
      req.user?.region
    ) {
      if (
        overlap.institution &&
        overlap.institution.region !== req.user.region
      ) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Overlap group outside your region',
        });
      }
    }

    res.json({ success: true, data: overlap });
  } catch (error) {
    next(error);
  }
};

export const resolveOverlap = async (req, res, next) => {
  try {
    const { status = 'coordinated', remarks } = req.body;

    if (!['coordinated', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "coordinated" or "dismissed"',
      });
    }

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Resolution remarks are required.',
      });
    }

    const overlap = await OverlapGroup.findById(req.params.id)
      .populate('cases');

    if (!overlap) {
      return res.status(404).json({
        success: false,
        message: 'Overlap group not found',
      });
    }

    // Resolve permission is checked against the actual OverlapGroup,
    // not its ID as if it were a Case ID.
    if (req.user.role !== 'super_admin') {
      if (!['bureau_officer', 'data_operator'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorised to resolve overlap groups.',
        });
      }

      const userBureauId = req.user.bureau?._id
        ? req.user.bureau._id.toString()
        : req.user.bureau?.toString();

      const representedBureaus = new Set(
        overlap.cases
          .map((caseItem) => {
            const bureau = caseItem.currentBureau;

            return bureau?._id
              ? bureau._id.toString()
              : bureau?.toString();
          })
          .filter(Boolean)
      );

      if (
        !userBureauId ||
        !representedBureaus.has(userBureauId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You can resolve an overlap only when your bureau is represented in the group.',
        });
      }
    }

    // Regional officer restriction
    if (
      req.user?.role === 'regional_officer' &&
      req.user?.region
    ) {
      const inst = await Institution.findById(overlap.institution);

      if (inst && inst.region !== req.user.region) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Overlap group outside your region',
        });
      }
    }

    overlap.status = status;
    overlap.resolutionRemarks = remarks.trim();
    overlap.resolvedBy = req.user._id;
    overlap.resolvedAt = new Date();

    // Persist only the pairs actually evaluated by the overlap engine.
    // This prevents dismissal from suppressing unrelated, unevaluated pairs.
    if (status === 'dismissed') {
      const pairKeys = (overlap.candidatePairs || [])
        .filter((pair) => pair.caseA && pair.caseB)
        .map((pair) =>
          [pair.caseA.toString(), pair.caseB.toString()]
            .sort()
            .join(':')
        );

      overlap.dismissedCasePairs = [
        ...new Set([
          ...(overlap.dismissedCasePairs || []),
          ...pairKeys,
        ]),
      ];
    }

    await overlap.save();

    // Resolve open alerts associated with this overlap group.
    await Alert.updateMany(
      {
        overlapGroup: overlap._id,
        resolvedAt: { $exists: false },
      },
      { resolvedAt: new Date() }
    );
    // Notify relevant users when an overlap is coordinated.
if (status === 'coordinated') {
  await createOrUpdateAlert({
    alertType: 'overlap',
    overlapGroupId: overlap._id,
    institutionId: overlap.institution,
    message: `Overlap Coordinated: Cross-bureau complaints for ${
      overlap.institution?.name || 'an institution'
    } have been coordinated. Remarks: ${remarks.trim()}`,
    severity: 'medium',
    targetRoles: ['bureau_officer', 'senior_management'],
  });
}

    // Resolution is recorded on the OverlapGroup itself.
    // Do not create misleading CaseAction entries on complaints
    // owned by other bureaus.

    res.json({
      success: true,
      message: `Overlap group successfully marked as ${status}`,
      data: overlap,
    });
  } catch (error) {
    next(error);
  }
};

export const linkOverlapCases = async (req, res, next) => {
  try {
    if (req.user?.role === 'senior_management') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Senior Management has read-only access.',
      });
    }

    const {
      overlapId,
      caseAId,
      caseBId,
      linkType = 'related',
      remarks,
    } = req.body;

    if (!caseAId || !caseBId) {
      return res.status(400).json({
        success: false,
        message: 'Both caseAId and caseBId are required.',
      });
    }

    const [caseA, caseB] = await Promise.all([
      Case.findById(caseAId),
      Case.findById(caseBId),
    ]);

    if (!caseA || !caseB) {
      return res.status(404).json({
        success: false,
        message: 'One or both cases not found.',
      });
    }

    // Check existing link
    let link = await CaseLink.findOne({
      $or: [
        { caseA: caseAId, caseB: caseBId },
        { caseA: caseBId, caseB: caseAId },
      ],
    });

    if (!link) {
      link = await CaseLink.create({
        caseA: caseAId,
        caseB: caseBId,
        linkType,
        createdBy: req.user._id,
      });
    }

    // Add link reference to OverlapGroup if present
    if (overlapId) {
      const overlap = await OverlapGroup.findById(overlapId);

      if (overlap) {
        if (!overlap.confirmedLinks) {
          overlap.confirmedLinks = [];
        }

        if (!overlap.confirmedLinks.includes(link._id)) {
          overlap.confirmedLinks.push(link._id);
          await overlap.save();
        }
      }
    }

    // Add audit actions to both cases
    const auditRemarks =
      `Case officially linked to ${caseB.caseId} as ${linkType}. ` +
      `Remarks: ${remarks || 'Cross-bureau relationship confirmed'}`;

    await CaseAction.create({
      case: caseA._id,
      actionType: 'remark',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks: auditRemarks,
      timestamp: new Date(),
    });

    await CaseAction.create({
      case: caseB._id,
      actionType: 'remark',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks:
        `Case officially linked to ${caseA.caseId} as ${linkType}. ` +
        `Remarks: ${remarks || 'Cross-bureau relationship confirmed'}`,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: 'Cases successfully linked with audit history.',
      data: link,
    });
  } catch (error) {
    next(error);
  }
};
export const getOverlapCaseReadOnly = async (req, res, next) => {
  try {
    if (!['bureau_officer', 'data_operator'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Read-only cross-bureau access is restricted to bureau users.',
      });
    }

    const userBureauId = req.user.bureau?._id
      ? req.user.bureau._id.toString()
      : req.user.bureau?.toString();

    if (!userBureauId) {
      return res.status(403).json({
        success: false,
        message: 'User is not associated with a bureau.',
      });
    }

    const targetCase = await Case.findById(req.params.caseId)
      .populate('institution')
      .populate('currentBureau', 'name code type');

    if (!targetCase) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
    }

    if (targetCase.currentBureau?._id?.toString() === userBureauId) {
      return res.status(400).json({
        success: false,
        message: 'Use the regular case detail endpoint for your own bureau.',
      });
    }

    const ownCases = await Case.find({
      currentBureau: userBureauId,
    }).select('_id');

    const ownCaseIds = ownCases.map((item) => item._id);

    const overlap = await OverlapGroup.findOne({
      status: 'open',
      cases: targetCase._id,
      candidatePairs: {
        $elemMatch: {
          $or: [
            { caseA: targetCase._id, caseB: { $in: ownCaseIds } },
            { caseB: targetCase._id, caseA: { $in: ownCaseIds } },
          ],
        },
      },
    });

    if (!overlap) {
      return res.status(403).json({
        success: false,
        message: 'No authorised cross-bureau overlap access exists for this complaint.',
      });
    }

    const pair = overlap.candidatePairs.find((item) => {
      const a = item.caseA?.toString();
      const b = item.caseB?.toString();
      const targetId = targetCase._id.toString();

      return (
        (a === targetId && ownCaseIds.some((id) => id.toString() === b)) ||
        (b === targetId && ownCaseIds.some((id) => id.toString() === a))
      );
    });

    return res.json({
      success: true,
      readOnly: true,
      data: {
        _id: targetCase._id,
        caseId: targetCase.caseId,
        sourceSystem: targetCase.sourceSystem,
        institution: targetCase.institution,
        rawInstitutionName: targetCase.rawInstitutionName,
        category: targetCase.category,
        description: targetCase.description,
        receivedDate: targetCase.receivedDate,
        status: targetCase.status,
        currentBureau: targetCase.currentBureau,
        expectedDisposalDate: targetCase.expectedDisposalDate,
        overlapEvidence: pair || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOverlapExplanations = async (req, res, next) => {
  try {
    const overlap = await OverlapGroup.findById(req.params.id)
      .populate('institution', 'name region');

    if (!overlap) {
      return res.status(404).json({
        success: false,
        message: 'Overlap group not found.',
      });
    }

    let explanationQuery = {
      overlapGroup: overlap._id,
    };

    // Bureau users can access only explanations involving their own cases.
    if (['bureau_officer', 'data_operator'].includes(req.user?.role)) {
      const userBureauId = req.user.bureau?._id
        ? req.user.bureau._id.toString()
        : req.user.bureau?.toString();

      if (!userBureauId) {
        return res.status(403).json({
          success: false,
          message: 'User is not associated with a bureau.',
        });
      }

      const ownCases = await Case.find({
        currentBureau: userBureauId,
      }).select('_id');

      const ownCaseIds = ownCases.map((item) => item._id);
      console.log('DEBUG BUREAU ID:', userBureauId);
      console.log('DEBUG OWN CASE IDS:', ownCaseIds.map(id => id.toString()));
      console.log('DEBUG OVERLAP PAIRS:', overlap.candidatePairs);

      const overlapCaseIds = (overlap.cases || []).map((item) =>
        item?._id ? item._id.toString() : item.toString()
      );

      const ownCaseIdStrings = ownCaseIds.map((id) => id.toString());

      const hasOwnCase = overlapCaseIds.some((id) =>
        ownCaseIdStrings.includes(id)
      );

      if (!hasOwnCase) {
        return res.status(403).json({
          success: false,
          message: 'No authorised overlap access for this bureau.',
        });
      }

      explanationQuery.$or = [
        { caseA: { $in: ownCaseIds } },
        { caseB: { $in: ownCaseIds } },
      ];
    } else if (
      req.user?.role === 'regional_officer' &&
      req.user?.region &&
      overlap.institution?.region !== req.user.region
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Overlap group outside your region.',
      });
    }

    const explanations = await OverlapExplanation.find(explanationQuery)
      .select('caseA caseB aiAnalysis model generatedAt promptVersion')
      .sort({ generatedAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: explanations,
    });
  } catch (error) {
    next(error);
  }
};