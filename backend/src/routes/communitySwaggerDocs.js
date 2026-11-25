/**
 * Swagger/OpenAPI path docs for Community Groups & Events.
 * Mounted under /api/v1/connect (see connectRoutes.js).
 * This file is scanned by swagger-jsdoc via ./src/routes/*.js.
 */

/**
 * @swagger
 * tags:
 *   - name: Community
 *     description: Community Groups & Events APIs
 */

/**
 * @swagger
 * /api/v1/connect/page/{pageId}/members/search:
 *   get:
 *     summary: Find community members
 *     description: Search followers and staff of a community page by name or username.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Connect page ID
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (username or full name)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Matching members with communityRole
 *       403:
 *         description: Not a community member (private pages)
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/v1/connect/page/{pageId}/roles:
 *   get:
 *     summary: List community roles
 *     description: Returns owner, current user's role, and unlimited admin/moderator staff.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: owner, myRole, staff[]
 *   post:
 *     summary: Assign community role
 *     description: Owner or admins assign admin or moderator (unlimited). User must be an active member.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, role]
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, moderator]
 *     responses:
 *       200:
 *         description: Role assigned
 *       403:
 *         description: Only owner/admins can assign roles
 */

/**
 * @swagger
 * /api/v1/connect/page/{pageId}/roles/{userId}:
 *   delete:
 *     summary: Revoke community role
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role revoked
 *       403:
 *         description: Only owner/admins can revoke roles
 */

/**
 * @swagger
 * /api/v1/connect/page/{pageId}/group-chats:
 *   get:
 *     summary: List community group chats
 *     description: |
 *       Lists multi-chat rooms for a community. Lazily migrates legacy page chatRoomId
 *       into a default **General** chat when present. Community chat types are hidden from the main inbox.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: groupChats[] with isMember, joinRequestPending, canManage, isDefault
 *   post:
 *     summary: Create community group chat
 *     description: Owner/admins create a named chat with privacy public | request | invite.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 80
 *               description:
 *                 type: string
 *               privacy:
 *                 type: string
 *                 enum: [public, request, invite]
 *                 default: public
 *               requireJoinProof:
 *                 type: boolean
 *                 description: Only for privacy=request
 *               proofPrompt:
 *                 type: string
 *     responses:
 *       201:
 *         description: Group chat created (includes chatId)
 *       403:
 *         description: Only owner/admins can create
 */

/**
 * @swagger
 * /api/v1/connect/group-chats/{groupChatId}/join:
 *   post:
 *     summary: Join a community group chat
 *     description: |
 *       - **public** — instant join
 *       - **request** — creates pending join request (optional proof)
 *       - **invite** — rejected unless invited
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupChatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               proofText:
 *                 type: string
 *               proofFileUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joined or join request pending
 *       403:
 *         description: Invite-only or not a community member
 */

/**
 * @swagger
 * /api/v1/connect/group-chats/{groupChatId}/invite:
 *   post:
 *     summary: Invite a member to an invite-only group chat
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupChatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitee added to chat
 */

/**
 * @swagger
 * /api/v1/connect/group-chats/{groupChatId}/join-requests:
 *   get:
 *     summary: List pending group chat join requests
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupChatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending requests with user + proof
 *       403:
 *         description: Not allowed to moderate
 */

/**
 * @swagger
 * /api/v1/connect/group-join-requests/{requestId}/review:
 *   post:
 *     summary: Accept or reject a group chat join request
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accept, reject]
 *     responses:
 *       200:
 *         description: Request reviewed (accept adds user to chat + notifies)
 */

/**
 * @swagger
 * /api/v1/connect/page/{pageId}/events:
 *   get:
 *     summary: List community events
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: events[] with isRegistered, canManage
 *   post:
 *     summary: Create community event
 *     description: Creates event-wide chat + announcement channel. Hosts = creator, page owner, and hostIds.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, startsAt]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *               endsAt:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: object
 *               coverImage:
 *                 type: string
 *               maxParticipants:
 *                 type: integer
 *                 nullable: true
 *               visibility:
 *                 type: string
 *                 enum: [public, members, private]
 *                 default: members
 *               participationMode:
 *                 type: string
 *                 enum: [individual, group, both]
 *                 default: individual
 *               hostIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               registrationOpen:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Event created with chatId and announcementChatId
 */

/**
 * @swagger
 * /api/v1/connect/events/{eventId}:
 *   get:
 *     summary: Get event detail
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event with registration/competition summary
 *   patch:
 *     summary: Update event
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *               endsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               location:
 *                 type: object
 *               coverImage:
 *                 type: string
 *               maxParticipants:
 *                 type: integer
 *                 nullable: true
 *               visibility:
 *                 type: string
 *                 enum: [public, members, private]
 *               participationMode:
 *                 type: string
 *                 enum: [individual, group, both]
 *               registrationOpen:
 *                 type: boolean
 *               status:
 *                 type: string
 *                 enum: [draft, published, cancelled, completed]
 *               hostIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Event updated
 */

/**
 * @swagger
 * /api/v1/connect/events/{eventId}/register:
 *   post:
 *     summary: Register for an event (individual)
 *     description: Adds user to event chat + announcement channel. Team-only events must use create team.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Registered
 *       400:
 *         description: Registration closed, full, or team-required
 */

/**
 * @swagger
 * /api/v1/connect/events/{eventId}/teams:
 *   post:
 *     summary: Create event team
 *     description: |
 *       Captain creates a team and invites memberIds. Every teammate must be a Taatom user
 *       and community member. Team is incomplete until full roster accepts — blocks competition entry.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               expectedSize:
 *                 type: integer
 *                 minimum: 2
 *                 maximum: 50
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Invitees (excluding captain)
 *     responses:
 *       201:
 *         description: Team created (team chat created; invites notified)
 */

/**
 * @swagger
 * /api/v1/connect/event-teams/{teamId}/accept:
 *   post:
 *     summary: Accept event team invite
 *     description: Joins team chat; when roster complete, creates team registration and adds members to event chat.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invite accepted
 */

/**
 * @swagger
 * /api/v1/connect/events/{eventId}/host-dm:
 *   post:
 *     summary: Open event-scoped DM with a host
 *     description: Creates or returns a community_event_dm chat (not shown in main inbox).
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hostUserId]
 *             properties:
 *               hostUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: chatId for host DM
 */

/**
 * @swagger
 * /api/v1/connect/events/{eventId}/competition:
 *   post:
 *     summary: Create or enable event competition
 *     description: Host/community staff configure ranking by likes or views and allowed media.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               rankBy:
 *                 type: string
 *                 enum: [likes, views]
 *               allowedMedia:
 *                 type: string
 *                 enum: [post, short, both]
 *               rulesText:
 *                 type: string
 *               submissionsOpen:
 *                 type: boolean
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               endsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               frozen:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Competition upserted
 *   patch:
 *     summary: Update event competition settings
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               rankBy:
 *                 type: string
 *                 enum: [likes, views]
 *               allowedMedia:
 *                 type: string
 *                 enum: [post, short, both]
 *               rulesText:
 *                 type: string
 *               submissionsOpen:
 *                 type: boolean
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               endsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               frozen:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Competition updated
 */

/**
 * @swagger
 * /api/v1/connect/events/{eventId}/competition/submissions:
 *   post:
 *     summary: Submit competition entry
 *     description: |
 *       Body requires postId of a Taatom post or short owned by the registrant.
 *       Teams may enter only when roster is complete. One active submission per user;
 *       after host remove, submit a **new** postId (fresh like/view counts).
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId]
 *             properties:
 *               postId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Submission entered
 *       409:
 *         description: Already have an active submission
 */

/**
 * @swagger
 * /api/v1/connect/events/{eventId}/competition/submissions/{submissionId}:
 *   delete:
 *     summary: Host removes a competition submission
 *     description: Marks removed_by_host. Participant may upload a new post/short as a new submission (counts do not carry over).
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submission removed; entrant notified
 */

/**
 * @swagger
 * /api/v1/connect/events/{eventId}/competition/leaderboard:
 *   get:
 *     summary: Competition leaderboard
 *     description: |
 *       Sorts by host rankBy (likes or views). Team events aggregate as **sum** of members'
 *       active submission metrics. Auto-freezes when competition endsAt has passed.
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: competition, leaderboard[], rankBy, frozen
 */

module.exports = {};
