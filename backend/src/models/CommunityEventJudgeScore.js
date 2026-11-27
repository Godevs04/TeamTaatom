const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CommunityEventJudgeScoreSchema = new Schema(
  {
    competitionId: {
      type: Types.ObjectId,
      ref: 'CommunityEventCompetition',
      required: true,
      index: true,
    },
    eventId: {
      type: Types.ObjectId,
      ref: 'CommunityEvent',
      required: true,
      index: true,
    },
    submissionId: {
      type: Types.ObjectId,
      ref: 'CommunityEventSubmission',
      required: true,
      index: true,
    },
    judgeId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** 1–10 */
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
  },
  { timestamps: true }
);

CommunityEventJudgeScoreSchema.index(
  { competitionId: 1, submissionId: 1, judgeId: 1 },
  { unique: true }
);

module.exports = mongoose.model('CommunityEventJudgeScore', CommunityEventJudgeScoreSchema);
