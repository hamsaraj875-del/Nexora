import { Case } from '../models/Case.js';
import { CaseAction } from '../models/CaseAction.js';
import { CaseLink } from '../models/CaseLink.js';
import { Institution } from '../models/Institution.js';
import { Bureau } from '../models/Bureau.js';
import { OverlapGroup } from '../models/OverlapGroup.js';
import { SlaRule } from '../models/SlaRule.js';
import { checkInstitutionOverlap } from '../services/overlap.js';
import { generateCaseId } from '../services/ingestion.js';
import { createOrUpdateAlert, resolveCaseAlerts } from '../services/alerts.js';
import { escapeRegex } from '../utils/escapeRegex.js';

// ============================================================================
// HELPER: Annotate cases with overlap status and SLA flags (Fixes N+1 query)
// ============================================================================
export const annotateCasesWithOverlapAndSla = async (cases) => {
  const institutionIds = [
    ...new Set(
      cases
        .map((c) => c.institution?._id?.toString() || c.institution?.toString())
        .filter(Boolean)
    ),
  ];

  const openOverlaps = await OverlapGroup.find({
    institution: { $in: institutionIds },
    status: 'open',
  }).select('institution severity');

  const overlapMap = new Map();
  openOverlaps.forEach((og) => {
    overlapMap.set(og.institution.toString(), og.severity);
  });

  const now = new Date();
  return cases.map((c) => {
    const instId = c.institution?._id?.toString() || c.institution?.toString();
    const hasOverlap = instId ? overlapMap.has(instId) : false;
    const overlapSeverity = hasOverlap ? overlapMap.get(instId) : null;

    const isClosed = ['disposed', 'rejected'].includes(c.status);
    const isOverdue =
      c.expectedDisposalDate &&
      new Date(c.expectedDisposalDate) < now &&
      !isClosed;
    const isDueSoon =
      c.expectedDisposalDate &&
      new Date(c.expectedDisposalDate) >= now &&
      new Date(c.expectedDisposalDate).getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000 &&
      !isClosed;

    return {
      ...c.toObject(),
      hasOverlap,
      overlapSeverity,
      isOverdue,
      isDueSoon,
    };
  });
};

// ============================================================================
// OFFICER PORTAL CONTROLLERS (/api/officer/cases)
// ============================================================================

export const getCases = async (req, res, next) => {
  try {
    const {
      q,
      institution,
      aicteId,
      caseId,
      bureau,
      region,
      category,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // Regional officer restriction: own region only
    if (req.user.role === 'regional_officer' && req.user.region) {
      const insts = await Institution.find({ region: req.user.region }).select('_id');
      query.institution = { $in: insts.map((i) => i._id) };
    }

    // Bureau officer / data operator restriction: own bureau only
    if ((req.user.role === 'bureau_officer' || req.user.role === 'data_operator') && req.user.bureau) {
      const userBureauId = req.user.bureau._id ? req.user.bureau._id.toString() : req.user.bureau.toString();
      query.currentBureau = userBureauId;
    }

    // Keyword search with regex escaping
    if (q) {
      const escaped = escapeRegex(q);
      query.$or = [
        { caseId: new RegExp(escaped, 'i') },
        { rawInstitutionName: new RegExp(escaped, 'i') },
        { description: new RegExp(escaped, 'i') },
      ];
    }

    if (caseId) query.caseId = new RegExp(escapeRegex(caseId), 'i');
    if (category) query.category = category;
    if (status) query.status = status;
    if (bureau) {
      if (bureau === 'unassigned') {
        query.currentBureau = null;
      } else {
        query.currentBureau = bureau;
      }
    }

    if (institution) {
      query.rawInstitutionName = new RegExp(escapeRegex(institution), 'i');
    }

    if (aicteId || region) {
      const instFilter = {};
      if (aicteId) instFilter.aictePermanentId = new RegExp(escapeRegex(aicteId), 'i');
      if (region) instFilter.region = region;
      const matchedInsts = await Institution.find(instFilter).select('_id');
      query.institution = { $in: matchedInsts.map((i) => i._id) };
    }

    if (dateFrom || dateTo) {
      query.receivedDate = {};
      if (dateFrom) query.receivedDate.$gte = new Date(dateFrom);
      if (dateTo) query.receivedDate.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Case.countDocuments(query);

    const cases = await Case.find(query)
      .populate('institution')
      .populate('currentBureau', 'code name type')
      .populate('assignedOfficer', 'name email role')
      .sort({ receivedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const annotatedCases = await annotateCasesWithOverlapAndSla(cases);

    res.json({
      success: true,
      data: annotatedCases,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCaseById = async (req, res, next) => {
  try {
    const c = await Case.findById(req.params.id)
      .populate('institution')
      .populate('currentBureau')
      .populate('assignedOfficer', 'name email role')
      .populate('submittedBy', 'name email');

    if (!c) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    // Regional officer restriction: own region only
    if (req.user.role === 'regional_officer' && req.user.region) {
      if (c.institution && c.institution.region !== req.user.region) {
        return res.status(403).json({ success: false, message: 'Forbidden: Case outside your region' });
      }
    }

    // Bureau officer / data operator restriction: own bureau only
    if ((req.user.role === 'bureau_officer' || req.user.role === 'data_operator') && req.user.bureau) {
      const userBureauId = req.user.bureau._id ? req.user.bureau._id.toString() : req.user.bureau.toString();
      const caseBureauId = c.currentBureau?._id ? c.currentBureau._id.toString() : c.currentBureau?.toString();
      if (!caseBureauId || caseBureauId !== userBureauId) {
        return res.status(403).json({ success: false, message: 'Forbidden: Case outside your bureau' });
      }
    }

    // Find links
    const links = await CaseLink.find({
      $or: [{ caseA: c._id }, { caseB: c._id }],
    })
      .populate('caseA')
      .populate('caseB')
      .populate('createdBy', 'name email');

    // Find overlap group
    let overlap = null;
    let otherInstitutionCases = [];
    if (c.institution) {
      overlap = await OverlapGroup.findOne({
        institution: c.institution._id,
        status: 'open',
      }).populate({
        path: 'cases',
        populate: { path: 'currentBureau' },
      });

      // Other open cases for the same institution across bureaus
      otherInstitutionCases = await Case.find({
        institution: c.institution._id,
        _id: { $ne: c._id },
        status: { $in: ['pending', 'under_process', 'needs_info', 'transferred', 'escalated'] },
      }).populate('currentBureau', 'code name');
    }

    const now = new Date();
    const isClosed = ['disposed', 'rejected'].includes(c.status);
    const isOverdue = c.expectedDisposalDate && new Date(c.expectedDisposalDate) < now && !isClosed;
    const isDueSoon =
      c.expectedDisposalDate &&
      new Date(c.expectedDisposalDate) >= now &&
      new Date(c.expectedDisposalDate).getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000 &&
      !isClosed;

    res.json({
      success: true,
      data: {
        ...c.toObject(),
        links,
        overlap,
        otherInstitutionCases,
        isOverdue,
        isDueSoon,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCaseHistory = async (req, res, next) => {
  try {
    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    if (req.user.role === 'regional_officer' && req.user.region && c.institution) {
      const inst = await Institution.findById(c.institution);
      if (inst && inst.region !== req.user.region) {
        return res.status(403).json({ success: false, message: 'Forbidden: Case outside your region' });
      }
    }

    if ((req.user.role === 'bureau_officer' || req.user.role === 'data_operator') && req.user.bureau) {
      const userBureauId = req.user.bureau._id ? req.user.bureau._id.toString() : req.user.bureau.toString();
      const caseBureauId = c.currentBureau?.toString();
      if (!caseBureauId || caseBureauId !== userBureauId) {
        return res.status(403).json({ success: false, message: 'Forbidden: Case outside your bureau' });
      }
    }

    const actions = await CaseAction.find({ case: req.params.id })
      .populate('performedBy', 'name email role')
      .populate('fromBureau', 'code name')
      .populate('toBureau', 'code name')
      .populate('performedByBureau', 'code name')
      .sort({ timestamp: 1 });

    res.json({ success: true, data: actions });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign or reassign case to a bureau (Officer only)
 * POST /cases/:id/assign { bureauId, assignedOfficerId?, remarks, dueDate? }
 */
export const assignCase = async (req, res, next) => {
  try {
    const { bureauId, assignedOfficerId, remarks, dueDate } = req.body;
    if (!bureauId) {
      return res.status(400).json({ success: false, message: 'bureauId is required' });
    }

    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    const bureau = await Bureau.findById(bureauId);
    if (!bureau) return res.status(404).json({ success: false, message: 'Bureau not found' });

    const fromBureau = c.currentBureau;
    const previousStatus = c.status;

    c.currentBureau = bureau._id;
    if (assignedOfficerId) c.assignedOfficer = assignedOfficerId;
    if (dueDate) c.expectedDisposalDate = new Date(dueDate);
    c.status = 'pending'; // Status becomes 'pending' (assigned)
    c.lastActionText = `Assigned to ${bureau.name}: ${remarks || 'Case allocated to bureau'}`;
    c.lastActionDate = new Date();
    await c.save();

    await CaseAction.create({
      case: c._id,
      actionType: 'assigned',
      fromBureau: fromBureau || undefined,
      toBureau: bureau._id,
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      fromStatus: previousStatus,
      toStatus: 'pending',
      remarks: remarks || `Assigned to ${bureau.name}`,
      timestamp: new Date(),
    });

    // Notify the bureau
    await createOrUpdateAlert({
    alertType: 'pending_reminder',
    caseId: c._id,
    institutionId: c.institution,
    message: `New Case Assigned: Docket ${c.caseId} assigned to ${bureau.name}.`,
    severity: 'medium',
    targetRoles: ['bureau_officer'],
    bureauId: bureau._id,
    assignedOfficerId: assignedOfficerId || undefined,
    notifyOnUpdate: true,
  });

    if (c.institution) {
      await checkInstitutionOverlap(c.institution);
    }

    const updated = await Case.findById(c._id)
      .populate('institution')
      .populate('currentBureau')
      .populate('assignedOfficer', 'name email role');

    res.json({
      success: true,
      message: `Case successfully assigned to ${bureau.name}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const escalateCase = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    const prevStatus = c.status;
    c.status = 'escalated';
    c.lastActionText = `Case escalated: ${remarks || 'Critical timeline overdue'}`;
    c.lastActionDate = new Date();
    await c.save();

    await CaseAction.create({
      case: c._id,
      actionType: 'escalated',
      fromStatus: prevStatus,
      toStatus: 'escalated',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks: remarks || 'Case escalated to Senior Management',
      timestamp: new Date(),
    });

    if (c.institution) {
      await checkInstitutionOverlap(c.institution);
    }

    res.json({ success: true, message: 'Case escalated to Senior Management', data: c });
  } catch (error) {
    next(error);
  }
};

export const linkCases = async (req, res, next) => {
  try {
    const { caseAId, caseBId, linkType = 'related', remarks } = req.body;
    if (!caseAId || !caseBId) {
      return res.status(400).json({ success: false, message: 'Both caseA and caseB IDs are required' });
    }

    const [caseA, caseB] = await Promise.all([Case.findById(caseAId), Case.findById(caseBId)]);
    if (!caseA || !caseB) {
      return res.status(404).json({ success: false, message: 'One or both cases not found' });
    }

    const link = await CaseLink.create({
      caseA: caseA._id,
      caseB: caseB._id,
      linkType,
      createdBy: req.user._id,
    });

    await Promise.all([
      CaseAction.create({
        case: caseA._id,
        actionType: 'linked',
        performedBy: req.user._id,
        remarks: `Linked with case ${caseB.caseId} (${linkType}). ${remarks || ''}`,
      }),
      CaseAction.create({
        case: caseB._id,
        actionType: 'linked',
        performedBy: req.user._id,
        remarks: `Linked with case ${caseA.caseId} (${linkType}). ${remarks || ''}`,
      }),
    ]);

    res.status(201).json({ success: true, message: 'Cases linked successfully', data: link });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// BUREAU PORTAL CONTROLLERS (/api/bureau/cases)
// ============================================================================

const getUserBureauId = (user) => {
  if (!user || !user.bureau) return null;
  return user.bureau._id ? user.bureau._id.toString() : user.bureau.toString();
};

export const getBureauCases = async (req, res, next) => {
  try {
    const userBureauId = getUserBureauId(req.user);
    if (!userBureauId) {
      return res.status(403).json({ success: false, message: 'User is not associated with any bureau' });
    }

    const { status, category, q, overdue, page = 1, limit = 25 } = req.query;

    const query = { currentBureau: userBureauId };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (q) {
      const escaped = escapeRegex(q);
      query.$or = [
        { caseId: new RegExp(escaped, 'i') },
        { rawInstitutionName: new RegExp(escaped, 'i') },
        { description: new RegExp(escaped, 'i') },
      ];
    }

    if (overdue === 'true') {
      query.expectedDisposalDate = { $lt: new Date() };
      query.status = { $nin: ['disposed', 'rejected'] };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Case.countDocuments(query);

    const cases = await Case.find(query)
      .populate('institution')
      .populate('assignedOfficer', 'name email')
      .sort({ receivedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const annotated = await annotateCasesWithOverlapAndSla(cases);

    res.json({
      success: true,
      data: annotated,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBureauCaseById = async (req, res, next) => {
  try {
    const userBureauId = getUserBureauId(req.user);
    const c = await Case.findById(req.params.id)
      .populate('institution')
      .populate('currentBureau')
      .populate('assignedOfficer', 'name email role');

    if (!c) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    // Enforce scoping: 403 if case does not belong to user's bureau
    if (!c.currentBureau || c.currentBureau._id.toString() !== userBureauId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to cases outside your bureau.',
      });
    }

    // Read-only overlap note for bureau coordination
    let overlap = null;
    if (c.institution) {
      overlap = await OverlapGroup.findOne({
        institution: c.institution._id,
        status: 'open',
      }).populate('cases', 'caseId category currentBureau status');
    }

    const now = new Date();
    const isClosed = ['disposed', 'rejected'].includes(c.status);
    const isOverdue = c.expectedDisposalDate && new Date(c.expectedDisposalDate) < now && !isClosed;
    const isDueSoon =
      c.expectedDisposalDate &&
      new Date(c.expectedDisposalDate) >= now &&
      new Date(c.expectedDisposalDate).getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000 &&
      !isClosed;

    res.json({
      success: true,
      data: {
        ...c.toObject(),
        overlap,
        isOverdue,
        isDueSoon,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBureauCaseHistory = async (req, res, next) => {
  try {
    const userBureauId = getUserBureauId(req.user);
    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    if (!c.currentBureau || c.currentBureau.toString() !== userBureauId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Case is outside your bureau.' });
    }

    const actions = await CaseAction.find({ case: req.params.id })
      .populate('performedBy', 'name email role')
      .populate('fromBureau', 'code name')
      .populate('toBureau', 'code name')
      .sort({ timestamp: 1 });

    res.json({ success: true, data: actions });
  } catch (error) {
    next(error);
  }
};

/**
 * Bureau PATCH /cases/:id/status { status, remarks }
 * Allowed statuses: 'under_process', 'needs_info', 'disposed', 'rejected'
 * Mark Done (disposed) requires final remarks and sets disposedDate.
 */
export const updateBureauCaseStatus = async (req, res, next) => {
  try {
    const userBureauId = getUserBureauId(req.user);
    const { status, remarks } = req.body;

    const allowed = ['under_process', 'needs_info', 'disposed', 'rejected'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowed.join(', ')}`,
      });
    }

    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    // Enforce scoping
    if (!c.currentBureau || c.currentBureau.toString() !== userBureauId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot modify a case outside your bureau.',
      });
    }

    if (status === 'disposed' && (!remarks || !remarks.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A final remark is required to mark a case Done/Disposed.',
      });
    }

    const prevStatus = c.status;
    c.status = status;
    if (status === 'disposed') {
      c.disposedDate = new Date();
    }

    c.lastActionText = remarks || `Status changed from ${prevStatus} to ${status}`;
    c.lastActionDate = new Date();
    await c.save();

    await CaseAction.create({
      case: c._id,
      actionType: status === 'disposed' ? 'disposed' : status === 'rejected' ? 'rejected' : 'status_change',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      fromStatus: prevStatus,
      toStatus: status,
      remarks: remarks || `Status changed from ${prevStatus} to ${status}`,
      isPublic: true,
      timestamp: new Date(),
    });

    if (['disposed', 'rejected'].includes(status)) {
      await resolveCaseAlerts(c._id);
    }

    if (c.institution) {
      await checkInstitutionOverlap(c.institution);
    }

    res.json({
      success: true,
      message: `Case status updated to ${status}`,
      data: c,
    });
  } catch (error) {
    next(error);
  }
};

export const addBureauCaseAction = async (req, res, next) => {
  try {
    const userBureauId = getUserBureauId(req.user);
    const { actionType = 'action_taken', remarks, attachmentUrl } = req.body;

    if (!remarks) {
      return res.status(400).json({ success: false, message: 'Remarks are required' });
    }

    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    if (!c.currentBureau || c.currentBureau.toString() !== userBureauId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Case outside your bureau' });
    }

    const isPublic = req.body.isPublic !== undefined ? Boolean(req.body.isPublic) : (actionType !== 'note');

    const action = await CaseAction.create({
      case: c._id,
      actionType,
      isPublic,
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks,
      attachmentUrl,
      timestamp: new Date(),
    });

    c.lastActionText = remarks;
    c.lastActionDate = new Date();
    await c.save();

    res.status(201).json({ success: true, data: action });
  } catch (error) {
    next(error);
  }
};

/**
 * Bureau requests clarification from the student
 * POST /cases/:id/request-info { message }
 */
export const requestInfoFromStudent = async (req, res, next) => {
  try {
    const userBureauId = getUserBureauId(req.user);
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message to student is required' });
    }

    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    if (!c.currentBureau || c.currentBureau.toString() !== userBureauId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Case outside your bureau' });
    }

    const prevStatus = c.status;
    c.status = 'needs_info';
    c.lastActionText = `Information requested: ${message}`;
    c.lastActionDate = new Date();
    await c.save();

    const action = await CaseAction.create({
      case: c._id,
      actionType: 'info_requested',
      fromStatus: prevStatus,
      toStatus: 'needs_info',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks: message,
      isPublic: true,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Information request sent to student. Case marked as Needs Info.',
      data: action,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bureau transfers case to another bureau
 * POST /cases/:id/transfer { targetBureauId, remarks }
 */
export const transferBureauCase = async (req, res, next) => {
  try {
    const userBureauId = getUserBureauId(req.user);
    const { targetBureauId, remarks } = req.body;

    if (!targetBureauId) {
      return res.status(400).json({ success: false, message: 'Target bureau ID required' });
    }

    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    // Scoping: only transfer from MY bureau
    if (!c.currentBureau || c.currentBureau.toString() !== userBureauId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Case outside your bureau' });
    }

    const fromBureau = c.currentBureau;
    const toBureau = await Bureau.findById(targetBureauId);
    if (!toBureau) return res.status(404).json({ success: false, message: 'Target bureau not found' });

    const prevStatus = c.status;
    c.currentBureau = toBureau._id;
    c.status = 'transferred';
    c.lastActionText = `Transferred to ${toBureau.name}: ${remarks || 'Case transfer'}`;
    c.lastActionDate = new Date();
    await c.save();

    await CaseAction.create({
      case: c._id,
      actionType: 'transferred',
      fromBureau,
      toBureau: toBureau._id,
      fromStatus: prevStatus,
      toStatus: 'transferred',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks: remarks || `Transferred to ${toBureau.name}`,
      timestamp: new Date(),
    });

    await resolveCaseAlerts(c._id, ['pending_reminder']);

    if (c.institution) {
      await checkInstitutionOverlap(c.institution);
    }

    res.json({ success: true, message: `Case transferred to ${toBureau.name}`, data: c });
  } catch (error) {
    next(error);
  }
};

/**
 * Bureau escalates case back to officer queue
 * POST /cases/:id/escalate { remarks }
 */
export const escalateBureauCase = async (req, res, next) => {
  try {
    const userBureauId = getUserBureauId(req.user);
    const { remarks } = req.body;

    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });

    if (!c.currentBureau || c.currentBureau.toString() !== userBureauId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Case outside your bureau' });
    }

    const prevStatus = c.status;
    c.status = 'escalated';
    c.lastActionText = `Case escalated by bureau: ${remarks || 'Critical timeline / statutory escalation'}`;
    c.lastActionDate = new Date();
    await c.save();

    await CaseAction.create({
      case: c._id,
      actionType: 'escalated',
      fromStatus: prevStatus,
      toStatus: 'escalated',
      performedBy: req.user._id,
      performedByBureau: req.user.bureau?._id,
      remarks: remarks || 'Case escalated by bureau to Senior Management queue',
      timestamp: new Date(),
    });

    if (c.institution) {
      await checkInstitutionOverlap(c.institution);
    }

    res.json({ success: true, message: 'Case escalated to Officer queue', data: c });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// STUDENT PORTAL CONTROLLERS (/api/student/cases)
// ============================================================================

export const getStudentCases = async (req, res, next) => {
  try {
    const cases = await Case.find({ submittedBy: req.user._id })
      .populate('institution', 'name city state')
      .sort({ createdAt: -1 });

    const safeCases = cases.map((c) => ({
      _id: c._id,
      caseId: c.caseId,
      category: c.category,
      rawInstitutionName: c.rawInstitutionName,
      institution: c.institution,
      status: c.status,
      receivedDate: c.receivedDate,
      disposedDate: c.disposedDate,
      lastActionText: c.lastActionText,
      lastActionDate: c.lastActionDate,
      createdAt: c.createdAt,
    }));

    res.json({ success: true, data: safeCases });
  } catch (error) {
    next(error);
  }
};

export const getStudentCaseById = async (req, res, next) => {
  try {
    const c = await Case.findById(req.params.id).populate('institution', 'name city state');

    if (!c || !c.submittedBy || c.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Timeline of public updates only (NO internal remarks, officer emails, SLA internals)
    const publicActions = await CaseAction.find({
      case: c._id,
      isPublic: true,
    }).sort({ timestamp: 1 });

    const timeline = publicActions.map((a) => ({
      _id: a._id,
      actionType: a.actionType,
      remarks: a.remarks,
      isPublic: a.isPublic,
      attachmentUrl: a.attachmentUrl,
      timestamp: a.timestamp,
    }));

    // Find pending info requests if any
    const infoRequests = publicActions.filter((a) => a.actionType === 'info_requested');

    res.json({
      success: true,
      data: {
        _id: c._id,
        caseId: c.caseId,
        category: c.category,
        description: c.description,
        rawInstitutionName: c.rawInstitutionName,
        institution: c.institution,
        status: c.status,
        receivedDate: c.receivedDate,
        disposedDate: c.disposedDate,
        evidenceFiles: c.evidenceFiles || [],
        timeline,
        infoRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createStudentCase = async (req, res, next) => {
  try {
    const {
      institutionId,
      rawInstitutionName,
      rawState,
      category = 'Fee Issues',
      description,
      evidenceFiles = [],
    } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Complaint description is required' });
    }

    const caseId = await generateCaseId('STU');

    let institution = null;
    let institutionDoc = null;
    if (institutionId) {
      institutionDoc = await Institution.findById(institutionId);
      if (institutionDoc) institution = institutionDoc._id;
    }

    const sla = await SlaRule.findOne({ category });
    const daysToDispose = sla?.daysToDispose || 30;
    const receivedDate = new Date();
    const expectedDisposalDate = new Date(receivedDate.getTime() + daysToDispose * 24 * 60 * 60 * 1000);

    const newCase = await Case.create({
      caseId,
      sourceSystem: 'STUDENT_PORTAL',
      sourceCaseRef: caseId,
      institution: institution || undefined,
      rawInstitutionName: institutionDoc?.name || rawInstitutionName || 'Unknown Institution',
      rawState: institutionDoc?.region || institutionDoc?.state || rawState || 'Central',
      rawCity: institutionDoc?.city || '',
      matchStatus: institution ? 'matched' : 'unmatched',
      matchScore: institution ? 100 : 0,
      category,
      description,
      complainantType: 'Student',
      receivedDate,
      status: 'pending',
      currentBureau: undefined, // Unassigned: enters officer assignment queue & match review
      submittedBy: req.user._id, // Enforced from authenticated token
      evidenceFiles: Array.isArray(evidenceFiles)
        ? evidenceFiles.map((f) => (typeof f === 'string' ? { name: f, url: f } : f))
        : [],
      lastActionText: 'Complaint registered by student',
      lastActionDate: new Date(),
      nextActionText: 'Pending initial intake allocation by Officer',
      expectedDisposalDate,
    });

    await CaseAction.create({
      case: newCase._id,
      actionType: 'received',
      performedBy: req.user._id,
      remarks: 'Complaint filed via Student Portal',
      isPublic: true,
      timestamp: new Date(),
    });

    if (institution) {
      try {
        await checkInstitutionOverlap(institution);
      } catch (err) {
        console.warn('Overlap check non-blocking warning:', err.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Complaint filed successfully',
      data: {
        _id: newCase._id,
        caseId: newCase.caseId,
        category: newCase.category,
        status: newCase.status,
        receivedDate: newCase.receivedDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const replyStudentCase = async (req, res, next) => {
  try {
    const { message, attachments = [] } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message is required' });
    }

    const c = await Case.findById(req.params.id);
    if (!c || !c.submittedBy || c.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const prevStatus = c.status;
    c.status = 'pending'; // Sets status back to pending and notifies bureau
    c.lastActionText = `Student reply received: ${message.slice(0, 80)}`;
    c.lastActionDate = new Date();
    await c.save();

    const action = await CaseAction.create({
      case: c._id,
      actionType: 'info_replied',
      fromStatus: prevStatus,
      toStatus: 'pending',
      performedBy: req.user._id,
      remarks: message,
      attachmentUrl: attachments.length > 0 ? (attachments[0].url || attachments[0]) : undefined,
      isPublic: true,
      timestamp: new Date(),
    });

        // Notify bureau if assigned
    if (c.currentBureau) {
      await createOrUpdateAlert({
        alertType: 'pending_reminder',
        caseId: c._id,
        institutionId: c.institution,
        message: `Student Replied: Case ${c.caseId} received student clarification.`,
        severity: 'medium',
        targetRoles: ['bureau_officer'],
        bureauId: c.currentBureau,
        notifyOnUpdate: true,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reply submitted successfully. Case is now under review.',
      data: action,
    });
  } catch (error) {
    next(error);
  }
};