const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    exp: {
        type: Number,
        default: 0
    },
    level: {
        type: String,
        enum: ['잣밥', '일반인', '논란 작가', '논란의 달인', '논란의 신', '논란 그자체'],
        default: '잣밥'
    },
    stats: {
        postsCreated: { type: Number, default: 0 },
        likesReceived: { type: Number, default: 0 },
        likesGiven: { type: Number, default: 0 }
    }
});

// 경험치에 따른 등급 업데이트 메서드
userSchema.methods.updateLevel = function() {
    if (this.exp >= 1000) {
        this.level = '논란 그자체';
    } else if (this.exp >= 500) {
        this.level = '논란의 신';
    } else if (this.exp >= 300) {
        this.level = '논란의 달인';
    } else if (this.exp >= 150) {
        this.level = '논란 작가';
    } else if (this.exp >= 50) {
        this.level = '일반인';
    } else {
        this.level = '잣밥';
    }
};

module.exports = mongoose.model('User', userSchema);