'use strict';

var Datastore = require('@google-cloud/datastore');

// datastore config
var ds = Datastore({
    projectId: "cyberagent-127"
});
var kind = 'Messages';

// get entity id
function fromDatastore(obj) {
    obj.id = obj[Datastore.KEY].id;
    return obj;
}

// limit, pageToken,
function list() {}

module.exports = {};
//# sourceMappingURL=model-datastore.js.map