const
    _ = require('lodash'),
    http = require('http'),
    kefir = require('kefir'),
    crypto = require('crypto'),
    EventEmitter = require('events').EventEmitter;

const
    KILOBYTE = 1024,
    DEFAULT_MAX_REQUEST_SIZE = 50 * KILOBYTE,
    DEFAULT_HTTP_SERVER_PORT = 8888,
    DEFAULT_ROUTES = ["/webhook"],
    DEFAULT_SHARED_SECRET = "mysecret";

module.exports = class extends EventEmitter {

    constructor({
        maxRequestSize = DEFAULT_MAX_REQUEST_SIZE,
        httpServerPort = DEFAULT_HTTP_SERVER_PORT,
        routes = DEFAULT_ROUTES,
        sharedSecret = DEFAULT_SHARED_SECRET
    } = {}){

        super();

        // Create a stream that collects JSON payloads for the webhook and emits respective "event" events.
        let serverStream = kefir
            .stream(({ emit })=> http.createServer((req, res)=> emit({ req, res })).listen(httpServerPort))
            .flatMap(({ req, req: { url, method, headers: { "x-signature": signature } }, res })=> {
                let jsonStream = kefir.concat(_.compact([
                    // Check if the route and verb are expected/valid
                    !(_.includes(routes, url) && method === "POST") && kefir.later(0, 'Invalid route').flatMap(kefir.constantError),
                    kefir
                        .fromEvents(req.setEncoding(null), 'data')
                        .takeUntilBy(kefir.fromEvents(req, 'end'))
                        .scan((buf, chunk)=> Buffer.concat([buf, chunk]))
                        .flatMap((buffer)=> buffer.length < maxRequestSize ? kefir.constant(buffer) : kefir.constantError(`Payload exceeds ${~~(maxRequestSize/KILOBYTE)}KB`) )
                        .last()
                        .flatMap((rawBody)=> {
                            // Validate HMAC signature (if configured)
                            return !sharedSecret || crypto
                                .createHmac('sha1', sharedSecret)
                                .update(rawBody)
                                .digest('hex') === signature ? kefir.constant(rawBody) : kefir.constantError('Wrong payload signature');
                        })
                        .map((buffer)=> buffer.toString('utf8'))
                        .flatMap((rawString)=> {
                            // Parse JSON
                            let json = _.attempt(JSON.parse, rawString);
                            return !_.isError(json) ? kefir.constant(json) : kefir.constantError('Invalid JSON payload');
                        })
                ]))
                .takeErrors(1);

                // Convey error indication back to the HTTP client. This stream is used only for assembling status messages.
                // The business data (payloads) is contained within "jsonStream"
                jsonStream
                    .ignoreValues()
                    .flatMapErrors((err)=>kefir.constant([500, err]))
                    .beforeEnd(()=>[200, 'OK'])
                    .take(1)
                    .onValue(([statusCode, message])=>{
                        res.writeHead(statusCode, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ statusCode, message }));
                    });

                return jsonStream;
        });

        // Export data and errors
        serverStream.onValue((event)=> this.emit('event', event));
        serverStream.onError((error)=> this.emit('error', error));
    }
};