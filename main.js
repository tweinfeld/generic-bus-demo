const
    _ = require('lodash'),
    kefir = require('kefir'),
    RandomUserSessionSource = require('./source/random_user_session'),
    WebhookSource = require('./source/webhook'),
    CounterAnalyzer = require('./analyze/counter'),
    RedisOutput = require('./output/redis'),
    FileOutput = require('./output/file');

// Create a stream that hooks into the "event" and "error" events. Map errors to Kefir errors.
const createEventErrorStream = function(instance){
    return kefir.merge([
        kefir.fromEvents(instance, 'event'),
        kefir.fromEvents(instance, 'error').flatMap(kefir.constantError)
    ]);
};

// Two sample event sources: One generates random user-related events, the other reports "real world" payloads collected from an actual HTTP webhook
// The webhook source has been tested with "segment.com"'s
let
    randomUserSessionStream = createEventErrorStream(new RandomUserSessionSource({ eventDropRate: 5, numberOfRandomUsers: 100 })),
    webhookSourceStream = createEventErrorStream(new WebhookSource({ sharedSecret: "mysecret", httpServerPort: 8888, maxRequestSize: 1024 * 10 }));

// Kefir pool is similar to RxJS's "Source" or Bacon's "Bus".
// The main difference is that it does not provide direct value-injection interface.
// Instead, it allows streams to be imperatively plugged in and out of it.
let bus = kefir.pool();
bus.plug(randomUserSessionStream);
bus.plug(webhookSourceStream);

// Send relevant messages to the "Counter" analyzer
let counterAnalyzer = new CounterAnalyzer();
bus
    .filter(({ type })=> _.includes(["user_log_in", "user_log_out"], type))                  // Filter messages where the "type" field is one of two
    .onValue(counterAnalyzer.send);                                                          // Send the message to be handled by the analyzer

// Send messages with { channel: client } to a Redis list
let redisOutput = new RedisOutput({
    keyName: "logs",
    host: "192.168.99.100"
});

bus
    .filter(({ channel })=> channel === "client")
    .onValue((message)=> redisOutput.send(message));

// Send all messages to spanning log files
let fileOutput = new FileOutput({
    fileRollLimit: 5
});

bus.onValue(fileOutput.send);