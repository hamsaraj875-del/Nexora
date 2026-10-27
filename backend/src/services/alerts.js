import { Alert } from '../models/Alert.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { OverlapGroup } from '../models/OverlapGroup.js';
import { Institution } from '../models/Institution.js';

/**
 * Creates an alert if an open one of the same type does not already exist for this case/overlap.
 * Ensures overlap notifications reach all involved bureau officers and regional officers,
 * even when bureauId is not directly passed.
 */
export const createOrUpdateAlert = async ({
  alertType,
  caseId,
  institutionId,
  overlapGroupId,
  message,
  severity = 'medium',
  targetRoles = [],
  bureauId = null,
  assignedOfficerId = null,
}) => {
  // Check if open alert exists for this case/group & type
  const filter = {
    alertType,
    resolvedAt: { $exists: false },
  };

  if (caseId) filter.case = caseId;
  if (overlapGroupId) filter.overlapGroup = overlapGroupId;

  let alert = await Alert.findOne(filter);

  if (!alert) {
    alert = await Alert.create({
      alertType,
      case: caseId || undefined,
      institution: institutionId || undefined,
      overlapGroup: overlapGroupId || undefined,
      message,
      severity,
    });
  } else {
    alert.message = message;
    alert.severity = severity;
    await alert.save();
  }

  // Find users who should receive this notification
  const userConditions = [{ role: 'super_admin' }];

  if (targetRoles.includes('senior_management')) {
    userConditions.push({ role: 'senior_management' });
  }

  if (assignedOfficerId) {
    userConditions.push({ _id: assignedOfficerId });
  }

  if (targetRoles.includes('bureau_officer')) {
    if (bureauId) {
      userConditions.push({ role: 'bureau_officer', bureau: bureauId });
    } else if (overlapGroupId) {
      // Find all distinct bureaus involved in this overlap cluster
      const og = await OverlapGroup.findById(overlapGroupId).populate('cases');
      if (og && og.cases) {
        const bureauIds = [
          ...new Set(og.cases.map((c) => c.currentBureau?.toString()).filter(Boolean)),
        ];
        if (bureauIds.length > 0) {
          userConditions.push({ role: 'bureau_officer', bureau: { $in: bureauIds } });
        }
      }
    }
  }

  // Notify regional officer if the institution belongs to their region
  if (institutionId) {
    const inst = await Institution.findById(institutionId);
    if (inst && inst.region) {
      userConditions.push({ role: 'regional_officer', region: inst.region });
    }
  }

  const recipients = await User.find({
    isActive: true,
    $or: userConditions,
  });

  // Create notifications avoiding duplicates
  for (const user of recipients) {
    const existingNotif = await Notification.findOne({
      user: user._id,
      alert: alert._id,
    });

    if (!existingNotif) {
      await Notification.create({
        user: user._id,
        alert: alert._id,
        isRead: false,
      });
    }
  }

  return alert;
};

/**
 * Resolves active open alerts for a case when disposed, rejected, or re-routed.
 */
export const resolveCaseAlerts = async (caseId, alertTypes = null) => {
  if (!caseId) return;
  const filter = {
    case: caseId,
    resolvedAt: { $exists: false },
  };
  if (alertTypes && Array.isArray(alertTypes)) {
    filter.alertType = { $in: alertTypes };
  }
  await Alert.updateMany(filter, { resolvedAt: new Date() });
};
