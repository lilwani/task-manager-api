// Allows us to connect to MongoDB
const mongoose = require('mongoose');

mongoose.Promise=global.Promise;

// Omitting 27017 port number after localhost because i intend to use the default port 
mongoose.connect("mongodb://localhost/taskmanager",{useUnifiedTopology: true, useNewUrlParser : true}).then(() => {
    console.log("Connected to the MongoDb Database");
}).catch(err => {
    console.log("Connection was not possible !");
    console.log(err);
})

// To avoid deprecation warnings
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

module.exports = mongoose;