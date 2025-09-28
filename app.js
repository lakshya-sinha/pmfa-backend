import express from "express";
import ejs from "ejs";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import axios from "axios";

import TrialStudent from "./models/TrialStudent.js";
import WebsiteSetting from "./models/websiteSetting.js";
import ContactDetail from "./models/contactDetail.js";

dotenv.config();

const app = express();

//? Middlewares
app.use(cors());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================
// SendGrid Email Helper
// ============================
const SENDGRID_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

if (!SENDGRID_API_KEY || !EMAIL_FROM) {
  console.error("Missing EMAIL_API_KEY or EMAIL_FROM in .env");
  process.exit(1);
}

async function sendEmail({ to, subject, text }) {
  try {
    const res = await axios.post(
      "https://api.sendgrid.com/v3/mail/send",
      {
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: EMAIL_FROM },
        content: [{ type: "text/plain", value: text }],
      },
      {
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`Email sent to ${to}: ${res.status}`);
  } catch (err) {
    console.error("SendGrid email error:", err.response?.data || err.message);
  }
}

// ============================
// ENV variables
// ============================
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const COOKIE_NAME = process.env.COOKIE_NAME || "admin_token";
const HASH = process.env.ADMIN_PASSWORD_HASH;

if (!JWT_SECRET || !HASH) {
  console.error("Missing JWT_SECRET or ADMIN_PASSWORD_HASH in .env");
  process.exit(1);
}

// helper to sign token
function signAdminToken() {
  return jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// middleware to require admin
function requireAdmin(req, res, next) {
  const token =
    req.cookies[COOKIE_NAME] ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);
  if (!token) return res.redirect("/login");

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: "Invalid or expired token" });
    if (payload.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.admin = payload;
    next();
  });
}

// ============================
// Routes
// ============================

app.get("/login", (req, res) => res.render("login"));

// login endpoint
app.post("/login", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "password required" });

  try {
    const ok = await bcrypt.compare(password, HASH);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = signAdminToken();
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 1000 });
    res.redirect("/admin/dashboard");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

app.get("/", (req, res) => res.redirect("/login"));
app.get("/logout", (req, res) => { res.clearCookie(COOKIE_NAME); res.redirect("/login"); });

// admin dashboard
app.get("/admin/dashboard", requireAdmin, async (req, res) => {
  const ContactCount = await ContactDetail.countDocuments();
  const trialCount = await TrialStudent.countDocuments();
  res.render("dashboard", { trialCount, ContactCount });
});

// admin contact details
app.get("/admin/contactDetails", async (req, res) => {
  const contactDetails = await ContactDetail.find();
  res.render("contactUs.ejs", { contactDetails });
});

app.get("/admin/contactDetails/delete/:id", async (req, res) => {
  try {
    const deletedData = await ContactDetail.findByIdAndDelete(req.params.id);
    res.redirect(deletedData ? "/admin/contactDetails" : "/admin/dashboard");
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
    const deletedData = await TrialStudent.findByIdAndDelete(req.params.id);
    res.redirect(deletedData ? "/admin/trialStudents" : "/admin/dashboard");
  } catch (error) {
    res.send(error);
  }
});

// Website settings
app.get("/admin/settings", requireAdmin, async (req, res) => {
  let settings = await WebsiteSetting.findOne();
  if (!settings) { settings = new WebsiteSetting(); await settings.save(); }
  res.render("setting", { settings });
});

app.post("/admin/settings", requireAdmin, async (req, res) => {
  let settings = await WebsiteSetting.findOne();
  if (!settings) settings = new WebsiteSetting();
  Object.assign(settings, req.body);
  await settings.save();
  res.redirect("/admin/settings");
});

app.get("/admin/getSetting", async (req, res) => {
  const data = await WebsiteSetting.findOne();
  res.send(data);
});

// ============================
// Website user-side endpoints
// ============================

// Trial Student Registration
app.post("/api/v1/saveTrialStudents", async (req, res) => {
  const { PlayerName, PhoneNumber, SelectedCenter, DateOfBirth, individualTraining } = req.body;

  try {
    const newTrial = new TrialStudent({ PlayerName, PhoneNumber, SelectedCenter, DateOfBirth, individualTraining });
    await newTrial.save();

    await sendEmail({
      to: EMAIL_FROM,
      subject: "🎉 New Trial Student Registration",
      text: `
        New Trial Student Registered:
        Name: ${PlayerName}
        Phone: ${PhoneNumber}
        Center: ${SelectedCenter}
        DOB: ${DateOfBirth}
        Location If Selected: ${individualTraining}
      `
    });

    res.redirect("http://localhost:5500/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error saving trial student or sending email");
  }
});

// Contact Form Submission
app.post("/api/v1/saveContactDetails", async (req, res) => {
  const { ContactName, ContactPhone, ContactEmail, ContactSubject, ContactMessage } = req.body;

  try {
    const newContactDetails = new ContactDetail({ ContactName, ContactPhone, ContactEmail, ContactSubject, ContactMessage });
    await newContactDetails.save();

    await sendEmail({
      to: EMAIL_FROM,
      subject: "📩 New Contact Form Submission",
      text: `
        Name: ${ContactName}
        Phone: ${ContactPhone}
        Email: ${ContactEmail}
        Subject: ${ContactSubject}
        Message: ${ContactMessage}
      `
    });

    res.redirect("http://localhost:5500/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error saving contact details or sending email");
  }
});

export default app;
