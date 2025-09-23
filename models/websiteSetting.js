import mongoose from "mongoose";
const Schema = mongoose.Schema;

const WebsiteSettingSchema = new Schema({
  WebsiteName: {
    type: String,
    default: "PLAYMAKER FOOTBALL ACADEMY",
  },
  WebsiteDesciption: {
    type: String,
    default:
      "Whether you're a seasoned Pro or Beginner, the PMFA is perfect for you",
  },
  WebsiteEmail: {
    type: String,
    default: "footballacademyplaymaker@gmail.com",
  },
  WebsiteNumber: {
    type: String,
    default: "+91 9810454730",
  },
  AboutFootballClubDes: {
    type: String,
    default: `Looking for the <b>Best Football Academy in Gurgaon?</b>

At <b>Playmaker Football Academy</b>, we go beyond training players — we nurture <b>talent, character, and passion</b> for the game. Since 2019, we have guided more than <b>500 young athletes</b>, with several making their way into <b>top clubs across Europe and the USA</b>. Our presence in Gurgaon is built on a commitment to <b>excellence</b>, providing <b>structured coaching</b>, <b>modern facilities</b>, and a <b>player-first environment</b>.

Whether your child is starting their football journey or aiming to compete at higher levels, <b>Playmaker</b> offers the right blend of <b>professional training</b>, <b>values-based development</b>, and <b>proven results</b>. We are not just building footballers — we are shaping <b>future leaders</b>, on and off the field.
`,
  },
  OrganizeTournamentDes: {
    type: String,
    default: `At <b>Playmaker Football Academy</b>, we host engaging football tournaments and events for children aged <b>3 to 15</b>, designed to promote <b>learning, confidence, and sportsmanship</b>. Our offerings include <b>all-age category football tournaments</b>, <b>football-themed birthday parties</b>, <b>fun games</b>, and <b>corporate or school events</b> — all with <b>professional referees</b> to ensure fair play. Each match and activity encourages <b>teamwork, discipline, and skill development</b>, while guided by our <b>experienced coaches</b>. By participating, children not only learn <b>techniques and strategies</b> but also enjoy a <b>fun, safe, and inspiring environment</b>. At <b>Playmaker</b>, we transform every game into a <b>joyful journey</b>, fostering <b>growth, passion, and a lifelong love for football</b>.

`,
  },
  AboutTheClub: {
    type: String,
    default: `Founded in 2019, Playmaker Football Academy has proudly trained over 500 young athletes, with several of our players now representing top clubs across Europe and the USA (Dpauwu Club). Our vision goes beyond teaching football — we are dedicated to building stronger individuals who carry values both on and off the pitch. With a flexible, self-directed training approach, players are encouraged to ask questions, think critically, and express themselves with confidence. We create an environment of fun, engagement, and teamwork, where every child feels included and supported. At Playmaker, humility, respect, hard work, and emotional connection are as vital as performance. For us, true victory is achieved with passion, integrity, and love for the game.`,
  },
});

const WebsiteSetting = mongoose.model("WebsiteSetting", WebsiteSettingSchema);

export default WebsiteSetting;
