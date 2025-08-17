const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const MessageSchema = new Schema({
  sender: { type: Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ChatSchema = new Schema({
  participants: [{ type: Types.ObjectId, ref: 'User', required: true }],
  messages: [MessageSchema],
}, { timestamps: true });

ChatSchema.index({ participants: 1 });

module.exports = mongoose.model('Chat', ChatSchema);
