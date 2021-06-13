const express = require("express");
const app = express();
const cors = require('cors');
const { List, Task, User } = require("./Database/models/all-models")
const bodyParser = require('body-parser')
const jwt = require('jsonwebtoken')

const mongoose = require('./Database/mongoose');
const { remove } = require("./Database/models/list-model");

const port = process.env.PORT || 3000

// Loading body parser middleware
app.use(bodyParser.json());

app.use(cors());

app.use(function (req, res, next) {
    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token, _id'
    );
    next();
});


// Check if request has valid jwt token
let authenticate = (req, res, next) => {
    let token = req.header('x-access-token')

    jwt.verify(token, User.getSecretToken(), (err, decoded)=>{
        if(err) res.status(401).send(err)
        else {
            req.user_id = decoded._id
            next()
        }
    })
}


//validate refresh token
let verifySession = (req, res, next) => {
    // grab the refresh token from the request header
    let refreshToken = req.header('x-refresh-token');

    // grab the _id from the request header. This is the user's ID and not the session id
    let _id = req.header('_id');

    User.findByIDandToken(_id, refreshToken).then((user) => {
        if (!user) {
            // user couldn't be found
            return Promise.reject({
                'error': 'User not found. Make sure that the refresh token and user id are correct'
            });
        }


        // if the code reaches here - the user was found
        // therefore the refresh token exists in the database - but we still have to check if it has expired or not

        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        let isSessionValid = false;

        user.sessions.forEach((session) => {
            if (session.token == refreshToken) {
                // check if the session has expired
                console.log("----------------------------New session----------------")
                console.log(session)
                if (User.hasRefreshTokenExpired(session.expiresAt) == false) {
                    // refresh token has not expired
                    isSessionValid = true;
                }
            }
        });

        if (isSessionValid) {
            // the session is VALID - call next() to continue with processing this web request
            next();
        } else {
            // the session is not valid
            return Promise.reject({
                'error': 'Refresh token has expired or the session is invalid'
            })
        }

    }).catch((e) => {
        res.status(401).send(e);
    })
}


// List routes below

// Get all lists
app.get('/lists', authenticate, (req, res) => {
    List.find({
        _userId : req.user_id
    }).then((lists) => {
        if (lists == null) {
            res.send('The list is empty')
        } else {
            res.send(lists)
        }
    }).catch("Error in processing request GET:/lists");
})

// Create new list
app.post('/lists', authenticate, (req, res) => {
    let title = req.body.title;
    List.create({ 
        title, 
        _userId : req.user_id
    }).then((listDoc) => {
        res.send(listDoc)
    }).catch("Error in processing request POST:/lists");
})

// Update the list
app.patch('/lists/:id', authenticate, (req, res) => {
    List.findOneAndUpdate({ _id: req.params.id, _userId : req.user_id }, {
        $set: req.body
    }).then(() => {
        console.log("--List entry has been updated--\n");
        res.sendStatus(200)
    }).catch("Error in processing request PATCH:/lists");
})

// Delete the list
app.delete('/lists/:id', authenticate, (req, res) => {
    List.findOneAndRemove({ 
        _id: req.params.id,
        _userId : req.user_id
    }).then((removedDoc) => {
        res.send(removedDoc)
        deleteAllTasks(removedDoc.id)
    }).catch((err) => {
        res.send(err)
    })
})




// Task routes below

// Get the tasks
app.get('/lists/:listid/tasks', authenticate, (req, res) => {
    Task.find({
        _listID: req.params.listid
    }).then((theTasks) => {
        res.send(theTasks)
    }).catch((err) => {
        res.send(err)
        res.sendStatus(500)
    })
})


// Create new task
app.post('/lists/:listid/tasks', authenticate, (req, res) => {
    //only user with the specific user id should be able to create task for 
    
    List.findOne({
        _id : req.params.listid,
        _userId : req.user_id
    }).then((list)=>{
        // if valid list is returned
        if(list){
            return true
        }
        else{
            return false
        }
    }).then((booleanValueFromAbove)=>{
        if(booleanValueFromAbove){
            Task.create({
                title: req.body.title,
                _listID: req.params.listid
            }).then((newTask) => {
                res.send(newTask)
            }).catch((err) => {
                res.send(err)
                res.sendStatus(500)
            })
        }else{
            res.sendStatus(404)
        }
    })

   
})


// Update a task
app.patch('/lists/:listid/tasks/:taskid',authenticate, (req, res) => {
    
    List.findOne({
        _id: req.params.listid,
        _userId : req.user_id
    }).then(list =>{
        if(list){
            return true
        }
        return false
    }).then(canUpdateOrNot =>{
        if(canUpdateOrNot){
            Task.findOneAndUpdate({
                _id: req.params.taskid,
                _listID: req.params.listid
            }, {
                $set: req.body
            }).then(() => {
                res.send({message : "Successfullly updated task"})
            }).catch((err) => {
                res.send(err)
            })
        }else{
            res.sendStatus(404)
        }
    })
})


// Delete a Task 
app.delete('/lists/:listid/tasks/:taskid',authenticate, (req, res) => {
    
    List.findOne({
        _id: req.params.listid,
        _userId : req.user_id
    }).then(list =>{
        if(list){
            return true
        }
        return false
    }).then(canDeleteOrNot =>{
        if(canDeleteOrNot){
            Task.findOneAndDelete({
                _id: req.params.taskid,
                _listID: req.params.listid
            }).then((deletedTask) => {
                if (deletedTask == null) {
                    res.send("Task doesn't exist or has been deleted")
                } else {
                    res.send(deletedTask)
                }
            }).catch((err) => {
                res.send(err)
                res.sendStatus(500)
            })
        }else{
            res.sendStatus(404)
        }
    })
})



// User Login and authentication paths

//Add a new User
app.post('/users', (req, res)=>{
    let body = req.body

    let newUser = new User(body)
    newUser.save().then(()=>{
        return newUser.createSession().then((refreshToken)=>{
            return newUser.generateAccessAuthToken().then((accessToken)=>{
                return {refreshToken,accessToken}
            })
        })
    }).then((authTokens)=>{
        res
            .header('x-refresh-token', authTokens.refreshToken)
            .header('x-access-token', authTokens.accessToken)
            .send(newUser);
    }).catch((e) => {
        res.status(400).send(e);
    })
})



//Login authentication
app.post('/users/login', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email, password).then((user) => {
        return user.createSession().then((refreshToken) => {
            // Session created successfully - refreshToken returned.
            // now we geneate an access auth token for the user

            return user.generateAccessAuthToken().then((accessToken) => {
                // access auth token generated successfully, now we return an object containing the auth tokens
                return { accessToken, refreshToken }
                
            });
        }).then((authTokens) => {
            // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
            res
            .header('x-refresh-token', authTokens.refreshToken)
            .header('x-access-token', authTokens.accessToken)
                .send(user);
        })
    }).catch((e) => {
        res.status(400).send(e);
        console.log(e)
    });
})



//returned generated access token
app.get('/users/me/access-token', verifySession, (req, res) => {
    // we know that the user/caller is authenticated and we have the user_id and user object available to us
    req.userObject.generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch((e) => {
        res.status(400).send(e);
    });
})



// Helper method to delete all tasks from a specific list

let deleteAllTasks = (listID) =>{
    Task.deleteMany({
        _listID : listID
    }).then(()=>{
        console.log("Tasks from the "+ listID +" list have been removed")
    })
}


app.listen(port, () => console.log("Node/Express server running on port 3000"));
