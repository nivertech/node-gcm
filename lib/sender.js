/*!
 * node-gcm
 * Copyright(c) 2012 Marcus Farkas <marcus.farkas@spaceteam.at>
 * MIT Licensed
 */

var Constants = require('./constants');
var Message = require('./message');
var Result = require('./result');
var MulitcastResult = require('./multicastresult');
var querystring = require('querystring');

var https = require('https');
var timer = require('timers');

exports = module.exports = Sender;

function Sender (key) {
	this.key = key;
};

Sender.prototype.send = function(message, registrationId, retries, callback) {
	var attempt = 1;
	var result;
	var backoff = Constants.BACKOFF_INITIAL_DELAY;
	var tryAgain;

		this.sendNoRetry(message, registrationId, function lambda (result) {
			if(result === undefined) {
				if(attempt <= retries) {
					var sleepTime = backoff * 2 * attempt;
					if (sleepTime > Constants.MAX_BACKOFF_DELAY)
						sleepTime = Constants.MAX_BACKOFF_DELAY;
					timer.setTimeout(function () {
							sendNoRetryMethod(message, registrationId, lambda);
					},sleepTime);
				}
				else {
					console.log('Could not send message after ' + (retries + 1) + ' attempts');
					callback(result);
					} 
				attempt++;
			}
			else callback(result);
		});
};

var sendNoRetryMethod = Sender.prototype.sendNoRetry = function(message, registrationId, callback) {
	var body = {}, result = new Result();
	var regs = [];
	body[Constants.JSON_REGISTRATION_IDS] = [registrationId];
	if (message.delayWhileIdle !== undefined) {
		body[Constants.PARAM_DELAY_WHILE_IDLE] = message.delayWhileIdle ? '1' : '0';
	}
	if (message.collapseKey !== undefined) {
		body[Constants.PARAM_COLLAPSE_KEY] = message.collapseKey;
	}
	for (var data in message.data) {
		body[Constants.PARAM_PAYLOAD_PREFIX + data] = message.data[data];
	}

	var requestBody = JSON.stringify(body);

	var post_options = {
      	host: Constants.GCM_SEND_ENDPOINT,
      	port: '443',
      	path: Constants.GCM_SEND_ENDPATH,
      	method: 'POST',
      	headers: {
          	'Content-Type' : 'application/json',
          	'Content-length' : requestBody.length,
          	'Authorization' : 'key=' + this.key
      	}
  	};

  	var post_req = https.request(post_options, function(res) {
      	res.setEncoding('utf-8');
      	var statusCode = res.statusCode;

      	res.on('data', function (data) {
      		data = JSON.parse(data);
      		if (statusCode === 503) {
      			console.log('GCM services is unavailable');
      			callback();
      		}
      		else if (statusCode !== 200) {
      			console.log('Invalid request: ' + statusCode);
      			callback();
      		}
        	if(data.results[0].message_id)
        		result.messageId = data.results[0].message_id;
        	else if(data.results[0].error)
        		result.errorCode = data.results[0].error;
        	else if(data.results[0].registration_id)
        		result.canonicalRegistrationId = data.results[0].registration_id;
      		callback(result);
    	});
  	});

  	post_req.write(requestBody);
  	post_req.end();
};