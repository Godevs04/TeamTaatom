const mongoose = require('mongoose');

const ForgotSignIn = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,  
        required: true
    },
    code: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        required: true
    },
    resetToken: {
        type: String,
        required: false
    },
    resetTokenExpiry: {
        type: Date,
        required: false
    }
})

module.exports = mongoose.model('ForgotSignIn', ForgotSignIn);