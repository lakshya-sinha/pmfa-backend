import express from "express"
import ejs from "ejs";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
const app = express();
import cors from "cors";
import TrialStudent from "./models/TrialStudent.js";
import WebsiteSetting from "./models/websiteSetting.js";
import ContactDetail from "./models/contactDetail.js";


//? Middlewares
app.use(cors());
dotenv.config();
app.set("view engine", "ejs")
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser());


//* routes



const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const COOKIE_NAME = process.env.COOKIE_NAME || 'admin_token';
const HASH = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash from .env

if (!JWT_SECRET || !HASH) {
  console.error('Missing JWT_SECRET or ADMIN_PASSWORD_HASH in .env');
  process.exit(1);
}

// helper to sign token
function signAdminToken() {
  const payload = { role: 'admin' }; // minimal claims
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// middleware to require admin
function requireAdmin(req, res, next) {
  const token = req.cookies[COOKIE_NAME] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) return res.redirect("/login");

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.admin = payload;
    next();
  });
}
app.get("/login", async (req, res) => {
  res.render("login")
})
// login endpoint - only password required
app.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });

  try {
    const ok = await bcrypt.compare(password, HASH);
    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const token = signAdminToken();

    // set httpOnly cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      // secure: true, // uncomment in production with HTTPS
      maxAge: 60 * 60 * 1000 // matches token lifetime (1 hour) in ms
    });
    res.redirect("/admin/dashboard")
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
});


// logout
app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect("/login");
});

app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  const ContactCount = await ContactDetail.countDocuments();
  const trialCount = await TrialStudent.countDocuments();
  res.render("dashboard", { trialCount, ContactCount });
})
// protected admin route
app.get('/admin', requireAdmin, (req, res) => {
  res.json({ ok: true, secret: 'only admin sees this' });
});


//admin stufff
app.get("/admin/contactDetails", async (req, res) => {
  const contactDetails = await ContactDetail.find();
  res.render("contactUs.ejs", { contactDetails });
})

app.get("/admin/contactDetails/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deletedData = await ContactDetail.findByIdAndDelete(id)
    if (deletedData) {
      return res.redirect("/admin/contactDetails");
    } else {
      return res.redirect("/admin/dashboard");
    }

  } catch (error) {
    res.send(error)
  }

})

app.get("/admin/trialStudents", async (req, res) => {
  const students = await TrialStudent.find();
  // res.send(data)
  res.render("trialStudentlist", { students });
})

app.get("/admin/trialStudents/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deletedData = await TrialStudent.findByIdAndDelete(id);
    if (deletedData) {
      res.redirect('/admin/trialStudents');
    }
    else {
      res.send("something went wrong!!");
    }
  } catch (error) {
    res.send(error)
  }
})

// Web setting

app.get("/admin/settings", requireAdmin, async (req, res) => {
  let settings = await WebsiteSetting.findOne();
  if (!settings) {
    settings = new WebsiteSetting();
    await settings.save();
  }
  // settings = new WebsiteSetting();
  // await settings.save();
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
})



//website data side

app.post("/api/v1/saveTrialStudents", async (req, res) => {
  const { PlayerName, PhoneNumber, SelectedCenter, DateOfBirth, SchoolName } = req.body;
  const newTrial = new TrialStudent({ PlayerName, PhoneNumber, SelectedCenter, DateOfBirth, SchoolName });
  const newData = await newTrial.save();
  res.redirect("http://localhost:5500/")
})

//website contact 

app.post("/api/v1/saveContactDetails", async (req, res) => {
  const { ContactName, ContactPhone, ContactEmail, ContactSubject, ContactMessage } = req.body;

  const newContactDetails = new ContactDetail({ ContactName, ContactPhone, ContactEmail, ContactSubject, ContactMessage });

  const newData = await newContactDetails.save();
  res.redirect("http://localhost:5500/")
})



export default app;