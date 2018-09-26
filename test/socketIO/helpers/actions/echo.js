const Promise = require('bluebird');
const { ActionTransport } = require('./../../../../src');

function EchoAction(request) {
  return Promise.resolve(request.params);
}

EchoAction.transports = [ActionTransport.socketIO, ActionTransport.http];

module.exports = EchoAction;
