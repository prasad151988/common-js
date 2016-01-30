var _ = require('lodash');

var collections = require('./collections/index');
var commands = require('./commands/index');
var lang = require('./lang/index');
var messaging = require('./messaging/index');
var timing = require('./timing/index');

module.exports = function() {
	'use strict';

	var namespaces = {
		Collections: collections,
		Commands: commands,
		Messaging: messaging,
		Timing: timing
	};

	return _.merge(lang, namespaces);
}();