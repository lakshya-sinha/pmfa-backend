import express from "express";
import ejs from "ejs";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";

import TrialStudent from "./models/TrialStudent.js";
import WebsiteSetting from "./models/websiteSetting.js";
import ContactDetail from "./models/contactDetail.js";
import NotificationSubscriber from "./models/NotificationSubscriber.js";
import webpush from "web-push";

const app = express();

//? Middlewares
app.use(cors());
dotenv.config();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// VAPID keys from environment only
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_READY = VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY;

if (!VAPID_READY) {
  console.error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in environment variables (.env file)');
  // Don't exit(1) here, let the app run without push capability
}

// Email sending removed — pushing notifications are used instead.


//* ENV variables
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const COOKIE_NAME = process.env.COOKIE_NAME || "admin_token";
const HASH = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash from .env

if (!JWT_SECRET || !HASH) {
  console.error("Missing JWT_SECRET or ADMIN_PASSWORD_HASH in .env");
  process.exit(1);
}

// Configure web-push if VAPID keys are present
if (VAPID_READY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:' + (process.env.EMAIL_USER || ''),
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  } catch (e) {
    console.error('Failed to set VAPID details for web-push', e);
    console.error('Please check your VAPID key format.');
  }
} else {
  console.warn('VAPID keys are not available; push notifications will be disabled.');
}

// helper to send push notifications to all subscribers
async function sendPushToAll(payload) {
  try {
    console.log('[push] Sending push notification:', payload);
    const subs = await NotificationSubscriber.find();
    console.log('[push] Found subscriptions:', subs.length);
    
    const sendPromises = subs.map(async (s) => {
      console.log('[push] Sending to endpoint:', s.endpoint);
      const pushSub = {
        endpoint: s.endpoint,
        keys: {
          p256dh: s.keys.p256dh,
          auth: s.keys.auth,
        },
      };
      try {
        await webpush.sendNotification(pushSub, JSON.stringify(payload));
        console.log('[push] Successfully sent to:', s.endpoint);
      } catch (err) {
        // If subscription is no longer valid, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log('[push] Removing invalid subscription:', s.endpoint);
          return NotificationSubscriber.deleteOne({ endpoint: s.endpoint });
        }
        console.error('[push] Send error:', err);
      }
    });
    await Promise.all(sendPromises);
  } catch (e) {
    console.error('[push] Error sending to subscribers:', e);
  }
}

// helper to sign token
function signAdminToken() {
  const payload = { role: "admin" };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// middleware to require admin
function requireAdmin(req, res, next) {
  const token =
    req.cookies[COOKIE_NAME] ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);
  if (!token) return res.redirect("/login");

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: "Invalid or expired token" });
    if (payload.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });
    req.admin = payload;
    next();
  });
}

app.get("/login", async (req, res) => {
  res.render("login");
});

// login endpoint - only password required
app.post("/login", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "password required" });

  try {
    const ok = await bcrypt.compare(password, HASH);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = signAdminToken();

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      // secure: true, // enable in production with HTTPS
      maxAge: 60 * 60 * 1000,
    });
    res.redirect("/admin/dashboard");
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
});
app.get("/", (req, res) => {
  res.redirect("/login");
})
// logout
app.get("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect("/login");
});

// admin dashboard
app.get("/admin/dashboard", requireAdmin, async (req, res) => {
  const ContactCount = await ContactDetail.countDocuments();
  const trialCount = await TrialStudent.countDocuments();
  res.render("dashboard", { trialCount, ContactCount });
});

// Expose VAPID public key to admin UI
app.get('/admin/getVapidPublicKey', requireAdmin, (req, res) => {
  if (!VAPID_READY || !VAPID_PUBLIC_KEY) return res.status(404).send('');
  res.send(VAPID_PUBLIC_KEY);
});

// Save a subscription
app.post('/admin/saveSubscription', requireAdmin, async (req, res) => {
  try {
    const sub = req.body;
    if (!sub || !sub.endpoint || !sub.keys) return res.status(400).json({ error: 'invalid subscription' });
    await NotificationSubscriber.updateOne(
      { endpoint: sub.endpoint },
      { endpoint: sub.endpoint, keys: sub.keys },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// Remove a subscription by endpoint
app.post('/admin/removeSubscription', requireAdmin, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await NotificationSubscriber.deleteOne({ endpoint });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// Reset (delete) all subscriptions - admin action
app.post('/admin/resetSubscriptions', requireAdmin, async (req, res) => {
  try {
    await NotificationSubscriber.deleteMany({});
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin test push endpoint to send a test notification to all subscribers
app.post('/admin/testPush', requireAdmin, async (req, res) => {
  try {
    if (!VAPID_READY) return res.status(400).json({ error: 'VAPID not configured' });
    const payload = {
      title: req.body.title || 'Test Notification',
      body: req.body.body || 'This is a test push notification',
      url: req.body.url || '/admin'
    };
    await sendPushToAll(payload);
    res.json({ ok: true });
  } catch (e) {
    console.error('Error sending test push', e);
    res.status(500).json({ error: 'server error' });
  }
});

// protected admin route
app.get("/admin", requireAdmin, (req, res) => {
  res.json({ ok: true, secret: "only admin sees this" });
});

// admin contact details
app.get("/admin/contactDetails", async (req, res) => {
  const contactDetails = await ContactDetail.find();
  res.render("contactUs.ejs", { contactDetails });
});

app.get("/admin/contactDetails/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deletedData = await ContactDetail.findByIdAndDelete(id);
    if (deletedData) {
      return res.redirect("/admin/contactDetails");
    } else {
      return res.redirect("/admin/dashboard");
    }
  } catch (error) {
    res.send(error);
  }
});

// admin trial students
app.get("/admin/trialStudents", async (req, res) => {
  const students = await TrialStudent.find();
  res.render("trialStudentlist", { students });
});

app.get("/admin/trialStudents/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deletedData = await TrialStudent.findByIdAndDelete(id);
    if (deletedData) {
      res.redirect("/admin/trialStudents");
    } else {
      res.send("something went wrong!!");
    }
  } catch (error) {
    res.send(error);
  }
});

// Website settings
app.get("/admin/settings", requireAdmin, async (req, res) => {
  let settings = await WebsiteSetting.findOne();
  if (!settings) {
    settings = new WebsiteSetting();
    await settings.save();
  }
  res.render("setting", { settings });
});

app.post("/admin/settings", requireAdmin, async (req, res) => {
  let settings = await WebsiteSetting.findOne();
  if (!settings) {
    settings = new WebsiteSetting();
  }
  settings.AboutTheClub = req.body.AboutTheClub;
  settings.WebsiteName = req.body.WebsiteName;
  settings.WebsiteDesciption = req.body.WebsiteDesciption;
  settings.WebsiteEmail = req.body.WebsiteEmail;
  settings.WebsiteNumber = req.body.WebsiteNumber;
  settings.AboutFootballClubDes = req.body.AboutFootballClubDes;
  settings.OrganizeTournamentDes = req.body.OrganizeTournamentDes;

  await settings.save();
  res.redirect("/admin/settings");
});

app.get("/admin/getSetting", async (req, res) => {
  let data = await WebsiteSetting.findOne();
  res.send(data);
});

// =============================
// Website user-side endpoints
// =============================

// Trial Student Registration
app.post("/api/v1/saveTrialStudents", async (req, res) => {
  const { PlayerName, PhoneNumber, SelectedCenter, DateOfBirth, individualTraining } =
    req.body;

  try {
    const newTrial = new TrialStudent({
      PlayerName,
      PhoneNumber,
      SelectedCenter,
      DateOfBirth,
      individualTraining,
    });
    await newTrial.save();

    // previously an email was sent here; nodemailer removed. Log for audit instead.
    console.log('New trial student registered', { PlayerName, PhoneNumber, SelectedCenter, DateOfBirth, individualTraining });

    // send web-push notification to subscribed admins (if configured)
    if (VAPID_READY) {
      sendPushToAll({
        title: 'New Trial Student',
        body: `Name: ${PlayerName} | Phone: ${PhoneNumber}`,
        url: '/admin/trialStudents'
      });
    }

  es.redirect(req.headers.origininalUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error saving trial student or sending mail");
  }
});

// Contact Form Submission
app.post("/api/v1/saveContactDetails", async (req, res) => {
  const {
    ContactName,
    ContactPhone,
    ContactEmail,
    ContactSubject,
    ContactMessage,
  } = req.body;

  try {
    const newContactDetails = new ContactDetail({
      ContactName,
      ContactPhone,
      ContactEmail,
      ContactSubject,
      ContactMessage,
    });
    await newContactDetails.save();

    // previously an email was sent here; nodemailer removed. Log the contact for audit.
    console.log('New contact form submitted', { ContactName, ContactPhone, ContactEmail, ContactSubject, ContactMessage });

    // send web-push notification to subscribed admins (if configured)
    if (VAPID_READY) {
      sendPushToAll({
        title: 'New Contact Form',
        body: `Name: ${ContactName} | Subject: ${ContactSubject}`,
        url: '/admin/contactDetails'
      });
    }

     res.redirect(req.headers.origininalUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error saving contact details or sending mail");
  }
});

export default app;
