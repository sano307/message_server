'use strict';

const Datastore = require('@google-cloud/datastore');

// datastore config
const ds = Datastore({
    projectId: "cyberagent-127"
});
const kind = 'Messages';

// get entity id
function fromDatastore (obj) {
    obj.id = obj[Datastore.KEY].id;
    return obj;
}

// limit, pageToken,
function list () {

}

module.exports = {

};