const express 	= require('express');
const sqlite3 	= require('sqlite3').verbose();

const cache		= require('memory-cache'); // perd le cache au redemarrage
const flatCache = require('flat-cache');   // persist cache sur serveur
const Memcached = require('memcached');

const redis		= require('redis');
const client	= redis.createClient();

const PORT		= process.env.PORT || 3128;
const app		= express();

// configure cache middleware
let memCache = new cache.Cache();
let cacheMiddleWare = (duration) => {
	return (req, res, next) => {
		let key = '__express__' + req.originalUrl || req.url;
		let cacheContent = memCache.get(key);
		if (cacheContent) {
			res.send(cacheContent);
			return;
		} else {
			res.sendResponse = res.send;
			res.send = (body) => {
				memCache.put(key, body, duration*1000);
				res.sendResponse(body);
			}
			next();
		}
	}
} 

// load new cache : persiste le cache dans le fichier "productsCache"
let fcache = flatCache.load('productsCache');  // ou;
// let cache = flatCache.load('productsCache', path.resolve('./path/to/folder');
// Create flat cache routes
let flatCacheMiddleware = (req, res, next) => {
	let key = '__express__' + req.originalUrl || req.url;
	let cacheContent = fcache.getKey(key);
	if (cacheContent) {
		res.send(cacheContent);
	} else {
		res.sendResponse = res.send;
		res.send = (body) => {
			fcache.setKey(key, body);
			fcache.save();
			res.sendResponse(body);
		}
		next();
	}
}

let memcached = new Memcached('127.0.0.1:3128');
let memcachedMiddleware = (duration) => {
	return (req, res, next) => {
		let key = '__express__' + req.originalUrl || req.url;
		memcached.get(key, function(err, data) {
			if (data) {
				res.send(data);
				return;
			} else {
				res.sendResponse = res.send;
				res.send = (body) => {
					memcached.set(key, body, (duration*60), function(err) {
						console.error(err);
					});
					res.sendResponse(body);
				}
				next();
			}
		});
	}
}

// create a redisMiddleware
let redisMiddleware = (req, res, next) => {
	let key = '__express__' + req.originalUrl || req.url;
	client.get(key, function(err, reply) {
		if (reply) {
			res.send(reply);
		} else {
			res.sendResponse = res.send;
			res.send = (body) => {
				client.set(key, JSON.stringify(body));
				res.sendResponse(body);
			}
			next();
		}
	});
}

/* Create app routes: 
	- cacheMiddleWare(30) ou 
	- flatCacheMiddleware ou
	- memcachedMiddleware */
app.get('/products', redisMiddleware, function(req, res) {
 	setTimeout(() => {
 		let db = new sqlite3.Database('./NodeInventory.db');
 		let sql = `SELECT * FROM products`;

 		db.all(sql, [], (err, rows) => {
 			if (err) {
 				throw err;
 			}
 			db.close();
 			res.send( rows );
 		});
 		// this was wrapped in a setTimeout function to intentionally 
        // simulate a slow request
 	}, 3000);
 });

 app.listen(PORT, function() {
 	console.log(`App running on port ${PORT}`);
 });