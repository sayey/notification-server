# Aqari Masry Notification Server

Free notification system using Node.js Express server deployed on Render for FCM notifications.

## Overview

This server replaces Firebase Cloud Functions with a free Node.js backend that sends push notifications via Firebase Cloud Messaging (FCM). It's designed to work with the Aqari Masry Flutter app.

## Features

- Send chat notifications to users and admins
- Support for Android, iOS, and Web
- Custom notification sounds
- Deep linking to chat conversations
- Scalable architecture for future features

## Prerequisites

- Node.js >= 18.0.0
- Firebase project with FCM enabled
- Firebase Service Account JSON key

## Local Setup

1. **Install dependencies:**
```bash
cd notification-server
npm install
```

2. **Get Firebase Service Account Key:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file
   - Copy the entire JSON content (as a string)

3. **Create `.env` file:**
```bash
cp .env.example .env
```

4. **Configure `.env`:**
```env
# Paste the entire Firebase Service Account JSON as a single line string
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}

# Server port (optional, defaults to 3000)
PORT=3000
```

5. **Run locally:**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Send Chat Notification
```
POST /api/notifications/chat
Content-Type: application/json

{
  "title": "رسالة جديدة",
  "body": "أحمد: هل الشقة متاحة؟",
  "recipientId": "user_uid_here",
  "chatId": "chat_id_here",
  "sound": "chat_alert"
}
```

Response:
```json
{
  "success": true,
  "messageId": "projects/...",
  "recipientId": "user_uid_here",
  "chatId": "chat_id_here"
}
```

### Send Broadcast Notification (Future Feature)
```
POST /api/notifications/broadcast
Content-Type: application/json

{
  "title": "رسالة جديدة",
  "body": "أحمد: هل الشقة متاحة؟",
  "recipientIds": ["user1", "user2"],
  "chatId": "chat_id_here",
  "sound": "chat_alert"
}
```

### Get User FCM Token (Debug)
```
GET /api/users/:userId/fcm-token
```

## Render Deployment

### Step 1: Prepare for Deployment

1. **Push code to GitHub:**
```bash
git add notification-server/
git commit -m "Add notification server"
git push
```

2. **Create Render account:**
   - Go to [render.com](https://render.com)
   - Sign up or log in

### Step 2: Deploy to Render

1. **Create new Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository
   - Configure:
     - **Name:** `aqari-notification-server`
     - **Branch:** `main`
     - **Root Directory:** `notification-server`
     - **Build Command:** `npm install`
     - **Start Command:** `node server.js`
     - **Instance Type:** `Free` (or paid for better performance)

2. **Add Environment Variables:**
   - In Render dashboard, go to your service
   - Click "Environment" tab
   - Add the following variables:
     - `FIREBASE_SERVICE_ACCOUNT`: Paste the entire Firebase Service Account JSON as a single line string
     - `PORT`: `3000` (Render sets this automatically, but you can specify)

3. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Render will provide a URL like: `https://aqari-notification-server.onrender.com`

### Step 3: Update Flutter App

1. **Set backend URL in Flutter:**
   - In your Flutter app, set the backend URL environment variable or update the code:
   
   ```dart
   // In lib/features/admin/data/admin_repository.dart
   final _backendUrl = 'https://aqari-notification-server.onrender.com';
   ```

   Or use environment variable:
   ```dart
   final _backendUrl = const String.fromEnvironment(
     'BACKEND_URL',
     defaultValue: 'https://aqari-notification-server.onrender.com',
   );
   ```

2. **Test the connection:**
   - Run your Flutter app
   - Send a chat message
   - Check if notification is received

## Firestore Structure

### Users Collection
```javascript
{
  uid: "user_id",
  email: "user@example.com",
  isAdmin: false,
  fcmToken: "device_fcm_token",  // Automatically updated by app
  fcmUpdatedAt: Timestamp,
  // ... other user fields
}
```

### Chats Collection
```javascript
{
  chatId: "userId_propertyId",
  userId: "user_id",
  lastMessage: "آخر رسالة",
  updatedAt: Timestamp,
  unreadByAdmin: 5,
  unreadByUser: 2,
  // ... other chat fields
}
```

## Flutter Integration

### FCM Token Management

The Flutter app automatically manages FCM tokens:

1. **On app start:**
   - `NotificationService.initialize()` is called
   - FCM token is retrieved
   - Token is saved to Firestore user document

2. **On token refresh:**
   - New token is automatically saved to Firestore

3. **On login:**
   - `NotificationService.syncTokenForUser(uid)` is called
   - Token is updated in Firestore

### Sending Notifications

When a chat message is sent:

1. Message is saved to Firestore
2. `ChatRepository.sendMessage()` calls backend API
3. Backend retrieves recipient's FCM token from Firestore
4. Backend sends FCM notification
5. Notification is delivered to device

## Testing

### Test Locally

1. **Start the server:**
```bash
npm run dev
```

2. **Test health endpoint:**
```bash
curl http://localhost:3000/health
```

3. **Test notification endpoint:**
```bash
curl -X POST http://localhost:3000/api/notifications/chat \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test message",
    "recipientId": "user_uid_here",
    "chatId": "test_chat_id",
    "sound": "default"
  }'
```

### Test on Render

1. **Test health endpoint:**
```bash
curl https://aqari-notification-server.onrender.com/health
```

2. **Test notification endpoint:**
```bash
curl -X POST https://aqari-notification-server.onrender.com/api/notifications/chat \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test message",
    "recipientId": "user_uid_here",
    "chatId": "test_chat_id",
    "sound": "default"
  }'
```

## Troubleshooting

### Server won't start
- Check that Node.js version is >= 18.0.0
- Verify `.env` file exists and is properly formatted
- Ensure Firebase Service Account JSON is valid

### Notifications not sending
- Check that recipient has valid FCM token in Firestore
- Verify Firebase Service Account has proper permissions
- Check server logs for errors
- Test with `/api/users/:userId/fcm-token` endpoint

### Render deployment fails
- Check that `package.json` is in the root directory
- Verify `start` script is defined
- Ensure all dependencies are listed
- Check Render build logs

### FCM token not updating
- Verify `NotificationService.syncTokenForUser()` is called on login
- Check that user has write permissions to Firestore
- Ensure Firebase Messaging is properly initialized

## Cost

- **Render Free Tier:** $0/month (with limitations)
  - 750 hours/month
  - 512MB RAM
  - 0.1 CPU
  - Sleeps after 15 minutes of inactivity

- **Render Starter ($7/month):** Recommended for production
  - Always awake
  - 512MB RAM
  - 0.5 CPU

- **Firebase FCM:** Free (included in Firebase free tier)

## Security

- Never commit `.env` file to version control
- Keep Firebase Service Account key secure
- Use HTTPS in production (Render provides this automatically)
- Consider adding API key authentication for production

## Future Enhancements

- Add authentication to API endpoints
- Support for multiple admin users
- Broadcast notifications to multiple users
- Notification scheduling
- Notification analytics
- Retry logic for failed notifications
- Webhook support for notification status updates

## Support

For issues or questions:
- Check Render logs in dashboard
- Review Firebase Console for FCM errors
- Test with curl commands to isolate issues
- Check Flutter app logs for FCM token updates
