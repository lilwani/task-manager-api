const express = require("express");
const app = express();
const cors = require('cors');
const { List, Task, User } = require("./Database/models/all-models")
const bodyParser = require('body-parser')
const jwt = require('jsonwebtoken')

const mongoose = require('./Database/mongoose')

const port = process.env.PORT || 3000

// Loading body parser middleware
app.use(bodyParser.json());

app.use(cors());

app.use(function (req, res, next) {
    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token'
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


// List routes below

// Get all lists
app.get('/lists', authenticate, (req, res) => {
    List.find().then((lists) => {
        if (lists == null) {
            console.log("--The list is empty--\n")
            res.send('The list is empty')
        } else {
            console.log("--Get List works--")
            //console.log(lists+"\n")
            res.send(lists)
        }
    }).catch("Error in processing request GET:/lists");
})

// Create new list
app.post('/lists', (req, res) => {
    let title = req.body.title;

    List.create({ title }).then((listDoc) => {
        console.log("--Post list works--")
        //console.log(listDoc)
        res.send(listDoc)
    }).catch("Error in processing request POST:/lists");
})

// Update the list
app.patch('/lists/:id', (req, res) => {
    List.findOneAndUpdate({ _id: req.params.id }, {
        $set: req.body
    }).then(() => {
        console.log("--List entry has been updated--\n");
        res.sendStatus(200)
    }).catch("Error in processing request PATCH:/lists");
})

// Delete the list
app.delete('/lists/:id', (req, res) => {
    List.findOneAndRemove({ _id: req.params.id }).then((removedDoc) => {
        console.log("--Deletion of the list was successfull--")
        //console.log(removedDoc+"\n")
        res.send(removedDoc)
    }).catch((err) => {
        res.send(err)
    })
})




// Task routes below

// Get the tasks
app.get('/lists/:listid/tasks', (req, res) => {
    Task.find({
        _listID: req.params.listid
    }).then((theTasks) => {
        console.log("--Tasks for the associated List ID have been retrieved--")
        console.log(theTasks + "\n")
        res.send(theTasks)
    }).catch((err) => {
        console.log("The Get Task request didn't go throught !")
        console.log(err)
        res.send(err)
        res.sendStatus(500)
    })
})


// Create new task
app.post('/lists/:listid/tasks', (req, res) => {
    Task.create({
        title: req.body.title,
        _listID: req.params.listid
    }).then((newTask) => {
        console.log("--New task has been added to the List--");
        console.log(newTask + "\n");
        res.send(newTask)
    }).catch((err) => {
        console.log("The create new Task request didn't go throught !")
        console.log(err)
        res.send(err)
        res.sendStatus(500)
    })
})


// Update a task
app.patch('/lists/:listid/tasks/:taskid', (req, res) => {
    Task.findOneAndUpdate({
        _id: req.params.taskid,
        _listID: req.params.listid
    }, {
        $set: req.body
    }).then(() => {
        console.log("--Task has been updated--\n")
        res.send({message : "Successfullly updated task"})
    }).catch((err) => {
        console.log("The update Task request didn't go throught !")
        console.log(err)
        res.send(err)
    })
})


// Delete a Task 
app.delete('/lists/:listid/tasks/:taskid', (req, res) => {
    Task.findOneAndDelete({
        _id: req.params.taskid,
        _listID: req.params.listid
    }).then((deletedTask) => {
        if (deletedTask == null) {
            console.log("--The task requested for deletion doesn't exist--")
            res.send("Task doesn't exist or has been deleted")
        } else {
            console.log("--Below Task has been deleted--")
            console.log(deletedTask)
            res.send(deletedTask)
        }
    }).catch((err) => {
        console.log("The deletion of Task request didn't go throught !")
        console.log(err)
        res.send(err)
        res.sendStatus(500)
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
    });
})


app.listen(port, () => console.log("Node/Express server running on port 3000"));
