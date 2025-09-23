import mongoose from "mongoose";
const Schema = mongoose.Schema;


const ContactDetailsSchema = new Schema({
  ContactName: {
    type: String,
    required: true,
  },
  ContactPhone: {
    type: Number,
    required: true,
  },
  ContactEmail: {
    type: String,
    required: true,
  },
  ContactSubject: {
    type: String,
    required: true,
  },
  ContactMessage: {
    type: String,
    required: true,
  }
})

const ContactDetail = mongoose.model("ContactDetail", ContactDetailsSchema);

export default ContactDetail;
