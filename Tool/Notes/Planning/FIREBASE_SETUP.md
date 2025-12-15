# Firebase Cloud Messaging (FCM) Setup Guide

This guide explains how to configure Firebase Admin SDK for push notifications in the Taatom backend.

## Prerequisites

1. Firebase project created at [Firebase Console](https://console.firebase.google.com/)
2. Service account key downloaded from Firebase Console

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Firebase Cloud Messaging Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Getting Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Project Settings** (gear icon) > **Service Accounts**
4. Click **Generate new private key**
5. Download the JSON file
6. Extract the following values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

## Private Key Formatting

The private key from Firebase JSON contains `\n` characters. When storing in `.env`:

**Option 1: Keep as-is (Recommended)**
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

The code automatically replaces `\n` with actual newlines.

**Option 2: Use actual newlines**
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
"
```

## Verification

After setting up environment variables, restart your backend server. You should see:

```
✅ Firebase Admin SDK initialized successfully
```

If Firebase is not configured, you'll see:

```
⚠️ Firebase Admin SDK: Missing required environment variables. Push notifications will be disabled.
```

## Notification Types Supported

The following notification types are automatically sent:

- **Like**: When someone likes a post
- **Comment**: When someone comments on a post
- **Follow**: When someone follows a user
- **Follow Request**: When someone sends a follow request
- **Follow Approved**: When a follow request is approved
- **Post Mention**: When someone mentions a user in a comment

## User Notification Preferences

Users can control notification preferences through their settings:
- `settings.notifications.likesNotifications`
- `settings.notifications.commentsNotifications`
- `settings.notifications.followsNotifications`
- `settings.notifications.followRequestNotifications`
- `settings.notifications.followApprovalNotifications`
- `settings.notifications.mentionsNotifications`

## Notification Payload Structure

All notifications follow the Taatom standard:

```json
{
  "title": "Notification Title",
  "body": "Notification Body",
  "data": {
    "type": "like|comment|follow|follow_request|follow_approved|post_mention",
    "screen": "/post/:id or /profile/:id",
    "entityId": "post_id or user_id",
    "senderId": "user_id_of_sender"
  }
}
```

## Deep Linking

Notifications include deep linking data compatible with Expo Router:
- Post-related notifications → `/post/:id`
- User-related notifications → `/profile/:id`

## Troubleshooting

### Push notifications not working

1. **Check environment variables**: Ensure all three Firebase variables are set
2. **Check logs**: Look for Firebase initialization messages in server logs
3. **Verify token**: Ensure user has a valid `expoPushToken` in their user record
4. **Check preferences**: Verify user's notification preferences are enabled

### Invalid token errors

If you see `messaging/invalid-registration-token` errors:
- The user's push token may be expired or invalid
- Tokens are automatically handled gracefully (notification skipped, no error thrown)
- Users should update their push token through the mobile app

### Firebase initialization fails

- Verify the private key is correctly formatted
- Ensure the service account has proper permissions
- Check that the project ID matches your Firebase project

## Security Notes

- **Never commit** `.env` file or Firebase service account JSON to version control
- Service account keys have admin access - keep them secure
- Rotate keys periodically for security
- Use environment variables in production (not hardcoded values)

## Production Deployment

For production deployment:

1. Set environment variables in your hosting platform (Heroku, AWS, etc.)
2. Ensure Firebase Admin SDK is initialized before handling requests
3. Monitor logs for Firebase errors
4. Set up alerts for notification failures

## Files Modified

- `src/config/firebase.js` - Firebase Admin SDK initialization
- `src/utils/sendNotification.js` - Notification sending utility
- `src/controllers/postController.js` - Like and comment notifications
- `src/controllers/profileController.js` - Follow and follow request notifications

