import app from "./app.js";
import connectDB from "./config/db.js";
import dotenv from "dotenv";

dotenv.config()




const PORT = process.env.PORT || 3000;
connectDB()
  .then(
    app.listen(PORT, () => {
      console.log("Server is Running on 8080")
    })
  ).catch((err) => {
    console.error(err)
  });
