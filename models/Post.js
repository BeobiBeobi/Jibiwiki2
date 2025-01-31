const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: String,
    description: String,
    username: String,
    category: String,
    explanation: {
        content: String,
        timestamp: Date
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    likes: {
        count: {
            type: Number,
            default: 0
        },
        users: [{
            username: String,
            likedAt: {
                type: Date,
                default: Date.now
            }
        }]
    }
});

module.exports = mongoose.model('Post', postSchema);