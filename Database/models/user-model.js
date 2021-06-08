const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const crypto = require("crypto");
const bcrypt = require("bcryptjs")
const _ = require('lodash')


const jwtSecret = "8261231382osepsaemen08341052245658584532"

const UserSchema = mongoose.Schema({
    email:{
        type : String,
        required : true,
        minlength : 3,
        unique : true
    },
    password:{
        type : String,
        required : true,
        minlength : 8
    },
    sessions : [{
        token : {
            type : String,
            required : true 
        },
        expriesAt : {
            type : Number,
            required : true
        }
    }]
});


// Instance methods, one where an instance of a class is created 

UserSchema.methods.toJSON =function(){
    const user = this
    const UserObject = user.toObject()
    
    // Do not return password and sessions
    return _.omit(UserObject,['password','sessions'])
}

UserSchema.methods.generateAccessAuthToken =function(){
    const user = this;

    return new Promise((resolve, reject)=>{
        // Create a new JWT token and return it 
        
        jwt.sign({ _id : user._id.toHexString() }, jwtSecret, {expiresIn : '15m'}, (err, token)=>{
            if(!err) return resolve(token);
            else reject();
        })
    })
}


UserSchema.methods.generateRefreshAuthToken = function(){
    //Generates a random 64byte hex string
    return new Promise((resolve, reject)=>{
        crypto.randomBytes(64, (err, token)=>{
            if(!err) return resolve(token.toString('hex'));
            else reject();
        })
    })
}




UserSchema.methods.createSession=function(){
    let user = this
//line 67 needs change where .then is attached to authtoken method and not save session
    return user.generateRefreshAuthToken().then((refreshToken)=>{
        return saveSessionToDatabase(user, refreshToken).then((refreshTokenAfterSavingToDB)=>{
            return refreshTokenAfterSavingToDB
        }).catch((err)=>{
            return Promise.reject("Error saving user to the Database" + err);
        })
    })
}



// Model methods

//Called upon User model and not the user instance / object much like the defined create(), find(), save() methods in MongoDB

UserSchema.statics.findByIDandToken = function(_id, token){
    const User = this

    return User.findOne({
        "_id":_id,
        "sessions.token":token    
    })
}


UserSchema.statics.findByCredentials = function (email, password) {
    let User = this;
    return User.findOne({ email }).then((user) => {
        if (!user) return Promise.reject();

        return new Promise((resolve, reject) => {
            bcrypt.compare(password, user.password, (err, res) => {
                if (res) {
                    resolve(user);
                }
                else {
                    reject();
                }
            })
        })
    })
}


UserSchema.statics.hasRefreshTokenExpired = (expiresAt) => {
    let secondsSinceEpoch = Date.now() / 1000;
    if (expiresAt > secondsSinceEpoch) {
        // hasn't expired
        return false;
    } else {
        // has expired
        return true;
    }
}

UserSchema.statics.getSecretToken = ()=>{
    return jwtSecret
}


//Middleware that hashes password before saving it 
UserSchema.pre('save',function(next){
    const user = this
    const cryptRounds = 10

   if(user.isModified('password')){
       //if password field has been changed or updated

       bcrypt.genSalt(cryptRounds, (err, salt)=>{
            bcrypt.hash(user.password, salt, (err,hash)=>{
                user.password = hash
                next()
            })
       })
   }else{
       next()
   }

})




// Helper methods for the methods above
function saveSessionToDatabase(user, refreshToken){
    return new Promise((resolve, reject)=>{
        let tokenExpiryTime = generateExpiryTime()

        //Data inserted to the instance of new User 
        user.sessions.push({'token': refreshToken, 'expriesAt' : tokenExpiryTime});

        //Saving the pushed data into database
        user.save().then(()=>{

            //Successfully saved to database
            return resolve(refreshToken);
        }).catch((err)=>{
            reject(err);
        })
    })
}



function generateExpiryTime(){
    let daysUntilExpiry = "10";
    let secondsUntilExpiry = ((daysUntilExpiry *24)*60)*60;
    return ((Date.now()/1000) + secondsUntilExpiry);
}


const User = mongoose.model('User', UserSchema)

module.exports= User