const mongoose = require("mongoose");

const thirdPartySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  assignedSchools: [
    {
      schoolId: {
        type: String,
        required: true,
      },
      schoolName: {
        type: String,
        required: true,
      },
    },
  ],
  image: {
    public_id: {
      type: String,
      default: "",
    },
    url: {
      type: String,
      default: "",
    },
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  role: {
    type: String,
    required: true,
    default: "thirdparty",
  },
  session: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ThirdPartyUser = mongoose.model("ThirdPartyUser", thirdPartySchema);
module.exports = ThirdPartyUser;