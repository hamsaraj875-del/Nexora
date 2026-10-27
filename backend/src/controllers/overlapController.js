import { OverlapGroup } from '../models/OverlapGroup.js';
import { CaseAction } from '../models/CaseAction.js';
import { CaseLink } from '../models/CaseLink.js';
import { Case } from '../models/Case.js';
import { Institution } from '../models/Institution.js';
import { Alert } from '../models/Alert.js';

export const getOverlaps = async (req, res, next) => {
  try {
    const { status = 'open', mine } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;

    // Regional officer restriction: own region institutions only
    if (req.user?.role === 'regional_officer' && req.user?.region) {
      const regionInsts = await Institution.find({ region: req.user.region }).select('_id');
      query.institution = { $in: regionInsts.map((i) => i._id) };
    }

    // Bureau mine=true filter: only overlaps involving MY bureau's cases
    if (mine === 'true' && req.user?.bureau) {
      const userBureauId = req.user.bureau._id ? req.user.bureau._id : req.user.bureau;
      const myBureauCases = await Case.find({ currentBureau: userBureauId }).select('_id');
      query.cases = { $in: myBureauCases.map((c) => c._id) };
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
        path: 'confirmedLinks',
        populate: [
          { path: 'caseA', select: 'caseId category status currentBureau' },
          { path: 'caseB', select: 'caseId category status currentBureau' },
          { path: 'createdBy', select: 'name email' },
        ],
      })
      .populate('resolvedBy', 'name email role');

    if (!overlap) {
      return res.status(404).json({ success: false, message: 'Overlap group not found' });
    }

    // Regional officer access check
    if (req.user?.role === 'regional_officer' && req.user?.region) {
      if (overlap.institution && overlap.institution.region !== req.user.region) {
        return res.status(403).json({ success: false, message: 'Forbidden: Overlap group outside your region' });
      }
    }

    res.json({ success: true, data: overlap });
  } catch (error) {
    next(error);
  }
};

export const resolveOverlap = async (req, res, next) => {
  try {
    // Senior management has read-only access
    if (req.user?.role === 'senior_management') {
      return res.status(403).json({ success: false, message: 'Forbidden: Senior Management has read-only monitoring access.' });
    }

    const { status = 'coordinated', remarks } = req.body;
    if (!['coordinated', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "coordinated" or "dismissed"' });
    }

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ success: false, message: 'Resolution remarks are required.' });
    }

    const overlap = await OverlapGroup.findById(req.params.id).populate('cases');
    if (!overlap) {
      return res.status(404).json({ success: false, message: 'Overlap group not found' });
    }

    // Regional officer check
    if (req.user?.role === 'regional_officer' && req.user?.region) {
      const inst = await Institution.findById(overlap.institution);
      if (inst && inst.region !== req.user.region) {
        return res.status(403).json({ success: false, message: 'Forbidden: Overlap group outside your region' });
      }
    }

    overlap.status = status;
    overlap.resolutionRemarks = remarks.trim();
    overlap.resolvedBy = req.user._id;
    overlap.resolvedAt = new Date();

    // If dismissed, store case pairs into dismissedCasePairs to prevent repeat alerts
    if (status === 'dismissed' && overlap.cases?.length >= 2) {
      const pairKeys = [];
      const cList = overlap.cases.map((c) => c._id.toString());
      for (let i = 0; i < cList.length; i++) {
        for (let j = i + 1; j < cList.length; j++) {
          pairKeys.push([cList[i], cList[j]].sort().join(':'));
        }
      }
      overlap.dismissedCasePairs = [...new Set([...(overlap.dismissedCasePairs || []), ...pairKeys])];
    }

    await overlap.save();

    // Resolve any open alerts associated with this overlap group
    await Alert.updateMany(
      { overlapGroup: overlap._id, resolvedAt: { $exists: false } },
      { resolvedAt: new Date() }
    );

    // Record resolution in every case audit trail
    for (const c of overlap.cases) {
      await CaseAction.create({
        case: c._id,
        actionType: 'remark',
        performedBy: req.user._id,
        performedByBureau: req.user.bureau?._id,
        remarks: `Cross-Bureau Overlap Resolution [${status.toUpperCase()}]: ${remarks.trim()}`,
        timestamp: new Date(),
      });
    }

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
      return res.status(403).json({ success: false, message: 'Forbidden: Senior Management has read-only access.' });
    }

    const { overlapId, caseAId, caseBId, linkType = 'related', remarks } = req.body;
    if (!caseAId || !caseBId) {
      return res.status(400).json({ success: false, message: 'Both caseAId and caseBId are required.' });
    }

    const [caseA, caseB] = await Promise.all([Case.findById(caseAId), Case.findById(caseBId)]);
    if (!caseA || !caseB) {
      return res.status(404).json({ success: false, message: 'One or both cases not found.' });
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
        if (!overlap.confirmedLinks) overlap.confirmedLinks = [];
        if (!overlap.confirmedLinks.includes(link._id)) {
          overlap.confirmedLinks.push(link._id);
          await overlap.save();
        }
      }
    }

    // Add audit actions to both cases
    const auditRemarks = `Case officially linked to ${caseB.caseId} as ${linkType}. Remarks: ${remarks || 'Cross-bureau relationship confirmed'}`;
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
      remarks: `Case officially linked to ${caseA.caseId} as ${linkType}. Remarks: ${remarks || 'Cross-bureau relationship confirmed'}`,
      timestamp: new Date(),
    });

    res.json({ success: true, message: 'Cases successfully linked with audit history.', data: link });
  } catch (error) {
    next(error);
  }
};
