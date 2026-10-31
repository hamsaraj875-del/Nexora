
import { Alert } from '../models/Alert.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { OverlapGroup } from '../models/OverlapGroup.js';
import { Institution } from '../models/Institution.js';

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
  notifyOnUpdate = false,
}) => {
  const filter = {
    alertType,
    resolvedAt: { $exists: false },
  };

  if (caseId) filter.case = caseId;
  if (overlapGroupId) filter.overlapGroup = overlapGroupId;

  let alert = await Alert.findOne(filter);
  let isNewAlert = false;
  let messageChanged = false;

  if (!alert) {
    alert = await Alert.create({
      alertType,
      case: caseId || undefined,
      institution: institutionId || undefined,
      overlapGroup: overlapGroupId || undefined,
      message,
      severity,
    });
    isNewAlert = true;
  } else {
    messageChanged = alert.message !== message;

    alert.message = message;
    alert.severity = severity;
    if (institutionId) alert.institution = institutionId;

    await alert.save();
  }

  const userConditions = [{ role: 'super_admin' }];

  if (targetRoles.includes('senior_management')) {
    userConditions.push({ role: 'senior_management' });
  }

  if (assignedOfficerId) {
    userConditions.push({ _id: assignedOfficerId });
  }

  if (targetRoles.includes('bureau_officer')) {
    if (bureauId) {
      userConditions.push({
        role: 'bureau_officer',
        bureau: bureauId,
      });
    } else if (overlapGroupId) {
      const group = await OverlapGroup.findById(overlapGroupId)
        .populate('cases');

      if (group?.cases) {
        const bureauIds = [
          ...new Set(
            group.cases
              .map((c) => c.currentBureau?.toString())
              .filter(Boolean)
          ),
        ];

        if (bureauIds.length) {
          userConditions.push({
            role: 'bureau_officer',
            bureau: { $in: bureauIds },
          });
        }
      }
    }
  }

  if (institutionId) {
    const institution = await Institution.findById(institutionId);

    if (institution?.region) {
      userConditions.push({
        role: 'regional_officer',
        region: institution.region,
      });
    }
  }

  const recipients = await User.find({
    isActive: true,
    $or: userConditions,
  }).select('_id');

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
    } else if (
      !isNewAlert &&
      notifyOnUpdate &&
      messageChanged &&
      existingNotif.isRead
    ) {
      existingNotif.isRead = false;
      await existingNotif.save();
    }
  }

  return alert;
};

export const resolveCaseAlerts = async (caseId, alertTypes = null) => {
  if (!caseId) return;

  const filter = {
    case: caseId,
    resolvedAt: { $exists: false },
  };

  if (Array.isArray(alertTypes)) {
    filter.alertType = { $in: alertTypes };
  }

  await Alert.updateMany(filter, {
    resolvedAt: new Date(),
  });
};
