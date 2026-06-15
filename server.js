require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountJson) {
  console.error('ERROR: FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  console.error('Please add this environment variable in Railway dashboard');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
  console.error('ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON');
  console.error('Make sure the value is a valid JSON string');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Send chat notification
app.post('/api/notifications/chat', async (req, res) => {
  try {
    const { title, body, recipientId, chatId, sound = 'default' } = req.body;

    if (!title || !body || !recipientId || !chatId) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, body, recipientId, chatId' 
      });
    }

    // Get recipient's FCM token from Firestore
    const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      return res.status(404).json({ error: 'FCM token not found for user' });
    }

    // Build notification payload
    const message = {
      token: fcmToken,
      notification: {
        title: title,
        body: body,
        sound: sound,
      },
      data: {
        title: title,
        body: body,
        chatId: chatId,
        sound: sound,
        type: 'chat',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'aqari_masry_chat_notifications_v2',
          priority: 'high',
          sound: sound,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body,
            },
            sound: sound === 'default' ? 'default' : `${sound}.wav`,
            badge: 1,
            'content-available': 1,
          },
        },
      },
      webpush: {
        notification: {
          title: title,
          body: body,
          icon: '/icons/Icon-192.png',
          badge: '/icons/Icon-192.png',
        },
        fcmOptions: {
          link: `/chat/thread/${chatId}`,
        },
      },
    };

    // Send notification
    const response = await admin.messaging().send(message);
    
    console.log('Notification sent successfully:', response);
    
    res.json({ 
      success: true, 
      messageId: response,
      recipientId: recipientId,
      chatId: chatId,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ 
      error: 'Failed to send notification',
      details: error.message 
    });
  }
});

// Send notification to multiple recipients (for future scalability)
app.post('/api/notifications/broadcast', async (req, res) => {
  try {
    const { title, body, recipientIds, chatId, sound = 'default' } = req.body;

    if (!title || !body || !recipientIds || !Array.isArray(recipientIds)) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, body, recipientIds (array)' 
      });
    }

    // Get all recipients' FCM tokens
    const userDocs = await admin.firestore()
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', recipientIds)
      .get();

    const tokens = [];
    userDocs.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken) {
        tokens.push({
          token: userData.fcmToken,
          userId: doc.id,
        });
      }
    });

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'No FCM tokens found for recipients' });
    }

    // Build multicast message
    const message = {
      notification: {
        title: title,
        body: body,
        sound: sound,
      },
      data: {
        title: title,
        body: body,
        chatId: chatId,
        sound: sound,
        type: 'chat',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'aqari_masry_chat_notifications_v2',
          priority: 'high',
          sound: sound,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body,
            },
            sound: sound === 'default' ? 'default' : `${sound}.wav`,
            badge: 1,
            'content-available': 1,
          },
        },
      },
      webpush: {
        notification: {
          title: title,
          body: body,
          icon: '/icons/Icon-192.png',
          badge: '/icons/Icon-192.png',
        },
        fcmOptions: {
          link: `/chat/thread/${chatId}`,
        },
      },
    };

    // Send multicast notification
    const response = await admin.messaging().sendMulticast({
      ...message,
      tokens: tokens.map(t => t.token),
    });

    console.log('Multicast notification sent:', response);
    
    res.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      recipientIds: recipientIds,
      chatId: chatId,
    });
  } catch (error) {
    console.error('Error sending multicast notification:', error);
    res.status(500).json({ 
      error: 'Failed to send multicast notification',
      details: error.message 
    });
  }
});

// Get user's FCM token (for debugging)
app.get('/api/users/:userId/fcm-token', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    res.json({ 
      userId: userId,
      hasFcmToken: !!fcmToken,
      fcmToken: fcmToken ? `${fcmToken.substring(0, 20)}...` : null,
    });
  } catch (error) {
    console.error('Error getting FCM token:', error);
    res.status(500).json({ 
      error: 'Failed to get FCM token',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Notification server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
