'use strict';

const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const redis = require('redis');
const redisClient = redis.createClient(6379, '35.185.172.137');

const redisSocket = require('socket.io-redis');
io.adapter(redisSocket({ host: '35.185.172.137', port: 6379 }));

const bodyParser = require('body-parser');

app.use(bodyParser());
app.use(bodyParser.urlencoded({extended: true}));

app.engine('.html', require('ejs').__express);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');

// set datastore
const Datastore = require('@google-cloud/datastore');
const datastore = Datastore({
    projectId: "cyberagent-127"
});

const nicknameOfServer = "socketServer_01";

/*
    REST API start
                    */

app.get('/', function(req, res){
    res.sendFile(__dirname + '/views/start_chatting.html');
});

app.post('/message', function(req, res) {
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
    const key = datastore.key(["Users", userId]);
    const query = datastore.createQuery('Users')
        .select(["address", "first_name", "last_name", "name", "image"])
        .filter("__key__", "=", key);

    return datastore.runQuery(query)
        .then((data) => {
            const entity = data[0];
            return entity;
        });
}

function getUserOfMessages(userKeys) {
    return datastore.get(userKeys)
        .then((data) => {
            const entities = data[0];
            entities.map(fromDatastore);
            return entities;
        });
}

function getUserForMessageById(userId) {
    const key = datastore.key(['Users', userId]);
    const query = datastore.createQuery('Users')
                    .select(['address', 'first_name', 'last_name', 'name', 'image'])
                    .filter('__key__', '=', key);

    return datastore.runQuery(query)
        .then((result) => {
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
    const query = datastore.createQuery('Messages')
        .filter('room_name', '=', roomName)
        .order('created_at')
        .limit(limit);

    return datastore.runQuery(query)
        .then((data) => {
            const entities = data[0];
            entities.map(fromDatastore);
            return entities;
        });
}

function getMessage(messageInfo) {
    const query = datastore.createQuery('Messages')
        .filter("room_name", "=", messageInfo.room_name)
        .order("created_at", {
            descending: true
        })
        .limit(1);

    return datastore.runQuery(query)
        .then((result) => {
        const entity = result[0];
        entity.map(fromDatastore);
        return entity;
    });
}

function getMessageById(messageId) {
    const key = datastore.key(["Messages", messageId]);
    const query = datastore.createQuery('Messages')
        .filter("__key__", "=", key);

    return datastore.runQuery(query)
        .then((result) => {
            return result[0];
        });
}

/*
    patch start
                */

function patchEditedMessage(messageId, messageInfo) {
    const entity = {
        key: datastore.key(['Messages', messageId]),
        data: messageInfo
    };

    return datastore.update(entity)
        .then(() => {
            return true;
        }).catch((error) => {
            return false;
        });
}

function patchReactionOfMessage(messageId, messageInfo) {
    const entity = {
        key: datastore.key(['Messages', messageId]),
        data: messageInfo
    };

    return datastore.update(entity)
        .then(() => {
            return true;
        }).catch((error) => {
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
    const key = datastore.key(['Messages', messageId]);

    return datastore.delete(key)
        .then(() => {
            return true;
        }).catch((error) => {
            return false;
        });
}

                /*
    delete end
*/

/*
    socket start
                */

io.on('connection', function(socket){
  console.log("On Connection");

  // enter the channel
  /*
    const enterInfo = {
        type: 0,
        from: 1234,
        to: 4321,
    }
  */

  socket.on("enter:room", function(enterInfo) {
    const roomName = convertRoomName(enterInfo);
    socket.join(roomName);

    redisClient.hvals(nicknameOfServer, function(err, data) {
        const cnt = ++data[1];
        console.log(cnt);

        redisClient.hset(nicknameOfServer, "cnt", cnt, function(err, reply) {
            console.log(reply);
            if(!err) {
                if(reply === 0) {
                    console.log('success');
                } else {
                    console.log('failed');
                }
            } else {
                console.log('error : ', err);
            }
        });
    });

    let container = {};
    getMessages(roomName, 20)
        .then((pastMessages) => {
            container = pastMessages;

            let tempUserKeys = [];
            container.forEach(function (element) {
                let userId = parseInt(element.from);
                console.log(userId);
                tempUserKeys.push(datastore.key(['Users', userId]));
            });

            return getUserOfMessages(tempUserKeys);
        })
        .then((usersInfo) => {
            container.forEach(function(messageElement, messageIndex) {
                usersInfo.forEach(function(userElement, userIndex) {
                    let userId = parseInt(messageElement.from);

                    if(userId == userElement.id) {
                        let tempUser = {
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

  socket.on("chat:room", function(messageInfo){
    const roomName = convertRoomName(messageInfo);

    messageInfo.created_at = new Date().getTime();
    messageInfo.updated_at = new Date().getTime();
    messageInfo.room_name = roomName;
    messageInfo.reactions = "";
    console.log("273 :", messageInfo);

    let container = {};
    const userId = parseInt(messageInfo.from);
    console.log(typeof userId);

    sendMessage(messageInfo)
        .then(() => {
            return getMessage(messageInfo);
        })
        .then((message) => {
            container = message[0];
            const userId = parseInt(message[0].from);

            return getUserOfMessage(userId);
        }).then((user) => {
            console.log(user);
            let tempUser = {
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

  socket.on("chat:room:edit", function(editMessageInfo) {
      const messageId = parseInt(editMessageInfo.id);

      let container = {};
      let tempMessage = {};
      getMessageById(messageId)
          .then((message) => {
                tempMessage = message[0];
                tempMessage.body = editMessageInfo.body;
                tempMessage.updated_at = new Date().getTime();

                return patchEditedMessage(messageId, tempMessage);
          }).then((result) => {
                console.log(result);
                if(result) {
                    // success edit message
                    return getUserOfMessage(parseInt(tempMessage.from));
                } else {
                    // failed edit message
                    container.status = "error";
                    container.message = "";

                    io.sockets.to(tempMessage.room_name).emit("chat:room:edit", container);

                    throw new Error('falied edited message!');
                }
          }).then((user) => {
                container.status = "success";

                user[0].id = parseInt(tempMessage.from);
                tempMessage.from = user[0];

                tempMessage.id = messageId;
                container.message = tempMessage;

                console.log(container);

                io.sockets.to(tempMessage.room_name).emit("chat:room:edit", container);

          }).catch((err) => {
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

  socket.on("chat:room:delete", function(deleteMessageInfo) {
      let container = {};

      const info = {
          type: deleteMessageInfo.type,
          to: deleteMessageInfo.to,
          from: deleteMessageInfo.from
      };

      const roomName = convertRoomName(info);

      const messageId = parseInt(deleteMessageInfo.id);
      deleteMessage(messageId)
          .then((result) => {
              if(result) {
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

  socket.on("chat:room:reaction", function(reactionInfo) {
      let container = {};
      let tempMessage = {};
      let tempReactions = [];

      // search message entity
      getMessageById(reactionInfo.id)
          .then((message) => {
          tempMessage = message[0];

          // search reaction in message
          let isEmoji = false;

          if(message[0].reactions) {
              tempReactions = message[0].reactions;
              tempReactions.forEach(function(element, index) {
                  if(element.from == reactionInfo.from && element.emoji == reactionInfo.emoji) {
                      delete tempReactions[index];
                      isEmoji = true;
                  }
              });
          }

          return isEmoji;

          }).then((result) => {
          if(!result) {
              // not exist emoji
              const reaction = {
                  from: reactionInfo.from,
                  emoji: reactionInfo.emoji
              };

              tempReactions.push(reaction);
          }

          console.log("351: ", tempReactions);
          tempMessage.reactions = tempReactions;

          return patchReactionOfMessage(reactionInfo.id, tempMessage);

          }).then((patchResult) => {

          if(patchResult) {
              // success update reaction
              return getMessageById(reactionInfo.id)
          } else {
              // failed update reaction
              container.status = "failed";
              container.message = "";

              throw new Error('falied update reaction!');
          }

          }).then((message) => {

          const userId = parseInt(tempMessage.from);

          return getUserForMessageById(userId);
          }).then((user) => {
          user[0].id = parseInt(tempMessage.from);

          tempMessage.from = user[0];
          tempMessage.id = reactionInfo.id;

          container.status = "success";
          container.message = tempMessage;
          console.log(container);

          io.sockets.to(tempMessage.room_name).emit("chat:room:reaction", container);

      }).catch((err) => {
          console.log(err);
      });
  });

  socket.on('disconnect', function () {
      redisClient.hvals(nicknameOfServer, function(err, data) {
          const cnt = --data[1];
          console.log(cnt);

          redisClient.hset(nicknameOfServer, "cnt", cnt, function(err, reply) {
              console.log(reply);
              if(!err) {
                  if(reply === 0) {
                      console.log('success');
                  } else {
                      console.log('failed');
                  }
              } else {
                  console.log('error : ', err);
              }
          });
      });
  });
});

/*
    socket end
                */

/*
    other libraries
                    */

function convertRoomName(info) {
  let roomName = "";

  if(info.type == 0) {
      // in channel
      roomName = info.type + "@" + info.to;
  } else {
      // in DM
      let temp = [info.from, info.to];
      temp.sort();
      roomName = info.type + "@" + temp[0] + "_" + temp[1];
  }

  return roomName;
}

server.listen(3000);