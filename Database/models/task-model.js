const { text } = require('express');
const mongoose = require('mongoose');

const TaskSchema = mongoose.Schema({
    title:{
        type: String,
        required : true,
        minLength : 1,
        trim : true
    },
    _listID :{
        type : mongoose.Types.ObjectId,
        required : true
    },
    completed :{
        type: Boolean,
        default : false
    }
    
})

const Task = mongoose.model('Task',TaskSchema);

module.exports = Task 