import mongoose from "mongoose";
const Schema = mongoose.Schema;


const TrialStudentSchema = new Schema({
  PlayerName: {
    type: String,
    required: true,
  },
  PhoneNumber: {
    type: Number,
    required: true,
  },
  SelectedCenter: {
    type: String,
    required: true,
  },
  DateOfBirth: {
    type: String,
    required: true,
  }

})

const TrialStudent = mongoose.model("TrialStudent", TrialStudentSchema);

export default TrialStudent;
