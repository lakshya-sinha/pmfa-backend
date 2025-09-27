import express from "express";
import ejs from "ejs";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import nodemailer from "nodemailer";

import TrialStudent from "./models/TrialStudent.js";
import WebsiteSetting from "./models/websiteSetting.js";
import ContactDetail from "./models/contactDetail.js";

const app = express();

//? Middlewares
app.use(cors());
dotenv.config();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//* Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // or custom SMTP
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});


transporter.verify((error, success) => {
  if (error) {
    console.error("Email connection error:", error);
  } else {
    console.log("Server is ready to send emails:", success);
  }
});


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

    // send email notification
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: process.env.MAIL_USER,
      subject: "🎉 New Trial Student Registration",
      text: `
        New Trial Student Registered:

        Name: ${PlayerName}
        Phone: ${PhoneNumber}
        Center: ${SelectedCenter}
        DOB: ${DateOfBirth}
        Location If Selected: ${individualTraining}
      `,
    });

    res.redirect("http://localhost:5500/");
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

    // send email notification
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: process.env.MAIL_USER,
      subject: "📩 New Contact Form Submission",
      text: `
        New Contact Form Submitted:

        Name: ${ContactName}
        Phone: ${ContactPhone}
        Email: ${ContactEmail}
        Subject: ${ContactSubject}
        Message: ${ContactMessage}
      `,
    });

    res.redirect("http://localhost:5500/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error saving contact details or sending mail");
  }
});

export default app;
