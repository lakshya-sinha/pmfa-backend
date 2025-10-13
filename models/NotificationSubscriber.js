import mongoose from "mongoose";
const Schema = mongoose.Schema;

const NotificationSubscriberSchema = new Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
});

const NotificationSubscriber = mongoose.model(
  "NotificationSubscriber",
  NotificationSubscriberSchema
);

export default NotificationSubscriber;
