
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';

export const getAlerts = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({ user: userId })
      .populate({
        path: 'alert',
        populate: [
          {
            path: 'case',
            select: 'caseId rawInstitutionName category status expectedDisposalDate receivedDate',
          },
          {
            path: 'institution',
            select: 'name city region aictePermanentId',
          },
          {
            path: 'overlapGroup',
            select: 'status severity overlapType reason institution',
          },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    const data = notifications.map((notification) => ({
      notificationId: notification._id,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      alert: notification.alert || null,
    }));

    res.json({
      success: true,
      unreadCount,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const markAlertAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      user: req.user._id,
    })
      .populate('alert')
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });

    res.json({
      success: true,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAlerts,
  markAlertAsRead,
  getStudentNotifications,
};
