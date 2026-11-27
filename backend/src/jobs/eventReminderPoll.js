/**
 * Polls community events / competitions and sends reminder pushes:
 * - Event start T-24h and T-1h → community_event_reminder
 * - Competition submissions close T-2h → community_competition_closing
 *
 * Idempotent via remindersSent flags on the documents.
 */
const CommunityEvent = require('../models/CommunityEvent');
const CommunityEventCompetition = require('../models/CommunityEventCompetition');
const CommunityEventRegistration = require('../models/CommunityEventRegistration');
const ConnectPage = require('../models/ConnectPage');
const Notification = require('../models/Notification');
const { sendNotificationToUser } = require('../utils/sendNotification');
const logger = require('../utils/logger');

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_RECIPIENTS = 200;

async function notifyRegistrants({
  event,
  pageName,
  type,
  title,
  body,
  kind,
}) {
  const regs = await CommunityEventRegistration.find({
    eventId: event._id,
    status: 'active',
    userId: { $ne: null },
  })
    .select('userId')
    .limit(MAX_RECIPIENTS)
    .lean();

  await Promise.all(
    regs.map(async (reg) => {
      if (!reg.userId) return;
      await Notification.createNotification({
        type,
        fromUser: event.createdBy,
        toUser: reg.userId,
        metadata: {
          kind,
          connectPageId: event.connectPageId.toString(),
          eventId: event._id.toString(),
          pageName,
          eventTitle: event.title,
          message: body.replace(/^[^ ]+ /, ''), // keep metadata short
        },
      }).catch(() => null);
      await sendNotificationToUser({
        userId: reg.userId.toString(),
        title,
        body,
        data: {
          type,
          connectPageId: event.connectPageId.toString(),
          eventId: event._id.toString(),
          fromUserId: event.createdBy.toString(),
          pageName,
          eventTitle: event.title,
          kind,
        },
      }).catch(() => null);
    })
  );
}

const pollEventReminders = async () => {
  try {
    const now = Date.now();

    // --- Event start reminders ---
    const upcoming = await CommunityEvent.find({
      status: 'published',
      startsAt: {
        $gte: new Date(now),
        $lte: new Date(now + 25 * HOUR_MS),
      },
    }).limit(100);

    for (const event of upcoming) {
      const msUntil = new Date(event.startsAt).getTime() - now;
      const page = await ConnectPage.findById(event.connectPageId).select('name').lean();
      const pageName = page?.name || 'community';
      const reminders = event.remindersSent || {};

      // T-24h window: between 23h and 25h before start
      if (
        !reminders.start24h &&
        msUntil <= 25 * HOUR_MS &&
        msUntil > 23 * HOUR_MS
      ) {
        await notifyRegistrants({
          event,
          pageName,
          type: 'community_event_reminder',
          title: 'Event tomorrow',
          body: `${event.title} starts in about 24 hours`,
          kind: 'community_event_reminder',
        });
        event.remindersSent = { ...reminders, start24h: new Date() };
        await event.save();
        logger.info(`Event reminder 24h sent for ${event._id}`);
      }

      // T-1h window: between 45m and 75m before start
      if (
        !reminders.start1h &&
        msUntil <= 75 * 60 * 1000 &&
        msUntil > 45 * 60 * 1000
      ) {
        await notifyRegistrants({
          event,
          pageName,
          type: 'community_event_reminder',
          title: 'Event starting soon',
          body: `${event.title} starts in about 1 hour`,
          kind: 'community_event_reminder',
        });
        event.remindersSent = {
          ...(event.remindersSent || {}),
          start1h: new Date(),
        };
        await event.save();
        logger.info(`Event reminder 1h sent for ${event._id}`);
      }
    }

    // --- Competition submissions closing T-2h ---
    const closingComps = await CommunityEventCompetition.find({
      enabled: true,
      submissionsOpen: true,
      frozen: false,
      endsAt: {
        $gte: new Date(now),
        $lte: new Date(now + 2.5 * HOUR_MS),
      },
      $or: [
        { 'remindersSent.submissions2h': null },
        { 'remindersSent.submissions2h': { $exists: false } },
        { remindersSent: { $exists: false } },
      ],
    }).limit(50);

    for (const competition of closingComps) {
      const msUntil = new Date(competition.endsAt).getTime() - now;
      if (msUntil > 2.25 * HOUR_MS || msUntil <= 1.75 * HOUR_MS) continue;

      const event = await CommunityEvent.findById(competition.eventId);
      if (!event || event.status === 'cancelled') continue;
      const page = await ConnectPage.findById(event.connectPageId).select('name').lean();
      const pageName = page?.name || 'community';

      await notifyRegistrants({
        event,
        pageName,
        type: 'community_competition_closing',
        title: 'Submissions closing soon',
        body: `Competition for ${event.title} closes in about 2 hours`,
        kind: 'community_competition_closing',
      });
      competition.remindersSent = {
        ...(competition.remindersSent || {}),
        submissions2h: new Date(),
      };
      await competition.save();
      logger.info(`Competition closing reminder sent for ${competition._id}`);
    }
  } catch (err) {
    logger.error('Event reminder poll failed:', err);
  }
};

const startEventReminderPollJob = () => {
  setInterval(pollEventReminders, POLL_INTERVAL_MS);
  // Kick once shortly after boot
  setTimeout(pollEventReminders, 20_000).unref?.();
  logger.info('Event reminder poll job started (runs every 5 minutes)');
};

module.exports = { startEventReminderPollJob, pollEventReminders };
