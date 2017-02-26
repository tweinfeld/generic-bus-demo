const
    redis = require('redis');

const
    DEFAULT_RECONNECT_TIME = 3000,
    DEFAULT_HOST = "localhost",
    DEFAULT_KEY_NAME = "log",
    REDIS_KEY_NAME = Symbol('KeyName'),
    REDIS_CLIENT = Symbol('RedisClient');

module.exports = class {
    constructor({
        reconnectTime = DEFAULT_RECONNECT_TIME,
        keyName = DEFAULT_KEY_NAME,
        host = DEFAULT_HOST
    }){
        this.keyName = keyName;
        this[REDIS_CLIENT] = redis.createClient({
            host,
            retry_strategy: ()=> DEFAULT_RECONNECT_TIME
        });
    }

    set keyName(name){
        this[REDIS_KEY_NAME] = name;
    }

    get keyName(){
        return this[REDIS_KEY_NAME];
    }

    send(message){
        this[REDIS_CLIENT].lpush(this[REDIS_KEY_NAME], message);
    }

};