'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var redis = require('socket.io-redis');
io.adapter(redis({ host: '35.185.172.137', port: 6379 }));

var bodyParser = require('body-parser');

app.use(bodyParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.engine('.html', require('ejs').__express);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');

// set datastore
var Datastore = require('@google-cloud/datastore');
var datastore = Datastore({
    projectId: "cyberagent-127"
});

/*
    REST API start
                    */

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/views/start_chatting.html');
});

app.post('/message', function (req, res) {
    console.log(req.body);
    //res.sendFile(__dirname + '/views/index.html', {authInfo: req.body});
    res.render('index', {
        authInfo: req.body
    });
});

/*
REST API end
*/

function fromDatastore(obj) {
    obj.id = obj[Datastore.KEY].id;
    return obj;
}

function sendMessage(message) {
    return datastore.save({
        key: datastore.key('Messages'),
        data: message
    });
}

function getUserOfMessage(userId) {
    var key = datastore.key(["Users", userId]);
    var query = datastore.createQuery('Users').select(["address", "first_name", "last_name", "name", "image"]).filter("__key__", "=", key);

    return datastore.runQuery(query).then(function (data) {
        var entity = data[0];
        return entity;
    });
}

function getUserOfMessages(userKeys) {
    return datastore.get(userKeys).then(function (data) {
        var entities = data[0];
        entities.map(fromDatastore);
        return entities;
    });
}

function getUserForMessageById(userId) {
    var key = datastore.key(['Users', userId]);
    var query = datastore.createQuery('Users').select(['address', 'first_name', 'last_name', 'name', 'image']).filter('__key__', '=', key);

    return datastore.runQuery(query).then(function (result) {
        console.log(result);
        return result;
    });

    /*
    const key = datastore.key(['Users', userId]);
    const query = datastore.createQuery('Users')
        .select(['address', 'first_name', 'last_name', 'name', 'image'])
        .filter('__key__', '=', key);
     return datastore.runQuery(query)
        .then((result) => {
            return result[0];
        });
        */
}

function getMessages(roomName, limit) {
    var query = datastore.createQuery('Messages').filter('room_name', '=', roomName).order('created_at').limit(limit);

    return datastore.runQuery(query).then(function (data) {
        var entities = data[0];
        entities.map(fromDatastore);
        return entities;
    });
}

function getMessage(messageInfo) {
    var query = datastore.createQuery('Messages').filter("room_name", "=", messageInfo.room_name).order("created_at", {
        descending: true
    }).limit(1);

    return datastore.runQuery(query).then(function (result) {
        var entity = result[0];
        entity.map(fromDatastore);
        return entity;
    });
}

function getMessageById(messageId) {
    var key = datastore.key(["Messages", messageId]);
    var query = datastore.createQuery('Messages').filter("__key__", "=", key);

    return datastore.runQuery(query).then(function (result) {
        return result[0];
    });
}

/*
    patch start
                */

function patchEditedMessage(messageId, messageInfo) {
    var entity = {
        key: datastore.key(['Messages', messageId]),
        data: messageInfo
    };

    return datastore.update(entity).then(function () {
        return true;
    }).catch(function (error) {
        return false;
    });
}

function patchReactionOfMessage(messageId, messageInfo) {
    var entity = {
        key: datastore.key(['Messages', messageId]),
        data: messageInfo
    };

    return datastore.update(entity).then(function () {
        return true;
    }).catch(function (error) {
        return false;
    });
}

/*
patch end
*/

/*
    delete start
                */

function deleteMessage(messageId) {
    var key = datastore.key(['Messages', messageId]);

    return datastore.delete(key).then(function () {
        return true;
    }).catch(function (error) {
        return false;
    });
}

/*
delete end
*/

/*
    socket start
                */

io.on('connection', function (socket) {
    console.log("On Connection");

    // enter the channel
    /*
      const enterInfo = {
          type: 0,
          from: 1234,
          to: 4321,
      }
    */

    socket.on("enter:room", function (enterInfo) {
        var roomName = convertRoomName(enterInfo);
        socket.join(roomName);

        io.of('/').adapter.clients(function (err, clients) {
            console.log(clients);
        });

        var container = {};
        getMessages(roomName, 20).then(function (pastMessages) {
            container = pastMessages;

            var tempUserKeys = [];
            container.forEach(function (element) {
                var userId = parseInt(element.from);
                console.log(userId);
                tempUserKeys.push(datastore.key(['Users', userId]));
            });

            return getUserOfMessages(tempUserKeys);
        }).then(function (usersInfo) {
            container.forEach(function (messageElement, messageIndex) {
                usersInfo.forEach(function (userElement, userIndex) {
                    var userId = parseInt(messageElement.from);

                    if (userId == userElement.id) {
                        var tempUser = {
                            id: userElement.id,
                            address: userElement.address,
                            first_name: userElement.first_name,
                            last_name: userElement.last_name,
                            name: userElement.name,
                            image: userElement.image
                        };

                        container[messageIndex].from = tempUser;

                        return true;
                    }
                });
            });

            socket.emit("enter:room", container);
        });
    });

    // chatting in channel
    /*
      const messageInfo = {d
          type: 0,
          from: 1234,
          to: 4321,
          body: $('#m').val()
      };
    */

    socket.on("chat:room", function (messageInfo) {
        var roomName = convertRoomName(messageInfo);

        messageInfo.created_at = new Date().getTime();
        messageInfo.updated_at = new Date().getTime();
        messageInfo.room_name = roomName;
        messageInfo.reactions = "";
        console.log("273 :", messageInfo);

        var container = {};
        var userId = parseInt(messageInfo.from);
        console.log(typeof userId === 'undefined' ? 'undefined' : _typeof(userId));

        sendMessage(messageInfo).then(function () {
            return getMessage(messageInfo);
        }).then(function (message) {
            container = message[0];
            var userId = parseInt(message[0].from);

            return getUserOfMessage(userId);
        }).then(function (user) {
            console.log(user);
            var tempUser = {
                id: userId,
                address: user[0].address,
                first_name: user[0].first_name,
                last_name: user[0].last_name,
                name: user[0].name,
                image: user[0].image
            };

            container.from = tempUser;

            io.sockets.to(messageInfo.room_name).emit("chat:room", container);
        });
    });

    // edit message
    /*
       const editMessageInfo = {
          id: 5072999279493120,
          body: "Hello"
       };
    */

    socket.on("chat:room:edit", function (editMessageInfo) {
        var messageId = parseInt(editMessageInfo.id);

        var container = {};
        var tempMessage = {};
        getMessageById(messageId).then(function (message) {
            tempMessage = message[0];
            tempMessage.body = editMessageInfo.body;
            tempMessage.updated_at = new Date().getTime();

            return patchEditedMessage(messageId, tempMessage);
        }).then(function (result) {
            console.log(result);
            if (result) {
                // success edit message
                return getUserOfMessage(parseInt(tempMessage.from));
            } else {
                // failed edit message
                container.status = "error";
                container.message = "";

                io.sockets.to(tempMessage.room_name).emit("chat:room:edit", container);

                throw new Error('falied edited message!');
            }
        }).then(function (user) {
            container.status = "success";

            user[0].id = parseInt(tempMessage.from);
            tempMessage.from = user[0];

            tempMessage.id = messageId;
            container.message = tempMessage;

            console.log(container);

            io.sockets.to(tempMessage.room_name).emit("chat:room:edit", container);
        }).catch(function (err) {
            console.log(err);
        });
    });

    // delete message
    /*
       const deleteMessageInfo = {
          id: 5072999279493120,
          body: "Hello"
       };
    */

    socket.on("chat:room:delete", function (deleteMessageInfo) {
        var container = {};

        var info = {
            type: deleteMessageInfo.type,
            to: deleteMessageInfo.to,
            from: deleteMessageInfo.from
        };

        var roomName = convertRoomName(info);

        var messageId = parseInt(deleteMessageInfo.id);
        deleteMessage(messageId).then(function (result) {
            if (result) {
                // success delete message
                container.status = "success";
                container.id = deleteMessageInfo.id;

                io.sockets.to(roomName).emit("chat:room:delete", container);
            } else {
                // failed delete message
                container.status = "error";
                container.discription = "fuck";

                io.sockets.to(roomName).emit("chat:room:delete", container);
            }
        });
    });

    // reaction in channel
    /*
        const reactionInfo = {
          id: 5072999279493120,
          from: 1,
          emoji: 1
      };
    */

    socket.on("chat:room:reaction", function (reactionInfo) {
        var container = {};
        var tempMessage = {};
        var tempReactions = [];

        // search message entity
        getMessageById(reactionInfo.id).then(function (message) {
            tempMessage = message[0];

            // search reaction in message
            var isEmoji = false;

            if (message[0].reactions) {
                tempReactions = message[0].reactions;
                tempReactions.forEach(function (element, index) {
                    if (element.from == reactionInfo.from && element.emoji == reactionInfo.emoji) {
                        delete tempReactions[index];
                        isEmoji = true;
                    }
                });
            }

            return isEmoji;
        }).then(function (result) {
            if (!result) {
                // not exist emoji
                var reaction = {
                    from: reactionInfo.from,
                    emoji: reactionInfo.emoji
                };

                tempReactions.push(reaction);
            }

            console.log("351: ", tempReactions);
            tempMessage.reactions = tempReactions;

            return patchReactionOfMessage(reactionInfo.id, tempMessage);
        }).then(function (patchResult) {

            if (patchResult) {
                // success update reaction
                return getMessageById(reactionInfo.id);
            } else {
                // failed update reaction
                container.status = "failed";
                container.message = "";

                throw new Error('falied update reaction!');
            }
        }).then(function (message) {

            var userId = parseInt(tempMessage.from);

            return getUserForMessageById(userId);
        }).then(function (user) {
            user[0].id = parseInt(tempMessage.from);

            tempMessage.from = user[0];
            tempMessage.id = reactionInfo.id;

            container.status = "success";
            container.message = tempMessage;
            console.log(container);

            io.sockets.to(tempMessage.room_name).emit("chat:room:reaction", container);
        }).catch(function (err) {
            console.log(err);
        });
    });

    socket.on('disconnect', function () {
        io.emit('user disconnected');
    });
});

/*
    socket end
                */

/*
    other libraries
                    */

function convertRoomName(info) {
    var roomName = "";

    if (info.type == 0) {
        // in channel
        roomName = info.type + "@" + info.to;
    } else {
        // in DM
        var temp = [info.from, info.to];
        temp.sort();
        roomName = info.type + "@" + temp[0] + "_" + temp[1];
    }

    return roomName;
}

server.listen(3000);
//# sourceMappingURL=index.js.map