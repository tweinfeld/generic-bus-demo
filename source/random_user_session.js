const
    _ = require('lodash'),
    kefir = require('kefir'),
    EventEmitter = require('events').EventEmitter;

// Define generator and template functions
const
    idGenerator = (function(generators){ return ()=> _.range(10).map(()=> _.sample(generators)).map((generator)=>generator()).join(''); })([[48, 57], [65, 90]].map((range)=>()=>String.fromCharCode(_.random.apply(null, range))));
    ipGenerator = ()=> _.range(4).map(()=> _.random(255)).join('.'),
    userAdmittanceTemplate = (type)=> (userId)=> ({ type: ["user", type].join('_'), id: userId }),
    userLogInTemplate = _.flow(userAdmittanceTemplate('log_in'), (baseEvent)=> Object.assign(baseEvent, { "ip_address": ipGenerator() })),
    userLogOutTemplate = userAdmittanceTemplate('log_out');

const
    SECOND = 1000,
    DEFAULT_NUMBER_OF_RANDOM_USERS = 10,                                // Number of random users to generate events for
    DEFAULT_EVENT_DROP_RATE = 1,                                        // Event drop rate (out of 100)
    DEFAULT_MAX_SESSION_DURATION = 60 * SECOND,                         // User session duration
    DEFAULT_MAX_LOGIN_INTERVAL_DURATION = 10 * SECOND;                  // Time between user sessions

module.exports = class extends EventEmitter {
    constructor({
        numberOfRandomUsers = DEFAULT_NUMBER_OF_RANDOM_USERS,
        maxSessionDuration = DEFAULT_MAX_SESSION_DURATION,
        maxLoginIntervalDuration = DEFAULT_MAX_LOGIN_INTERVAL_DURATION,
        eventDropRate = DEFAULT_EVENT_DROP_RATE
    } = {}){
        super();
        kefir.merge(
            _.range(numberOfRandomUsers).map(idGenerator).map((userId)=>
                // Create a stream that's assembled of individual kefir streams. New streams are generated when previous ones end.
                kefir.repeat(()=> {
                    // Establish the baseline delay after which the session should commence
                    let loginIntervalDelay = _.random(maxLoginIntervalDuration);
                    // Create a kefir stream which simulates a single user-session's lifespan admittance events (log in/out)
                    return kefir
                        .merge(
                            [
                                [loginIntervalDelay, userLogInTemplate(userId)],
                                [loginIntervalDelay + _.random(maxSessionDuration), userLogOutTemplate(userId)]
                            ].map((args)=>kefir.later(...args))
                        ).map((event) => Object.assign(event, {create: Date.now()}))
                })
            )
        )
        .filter((event)=> _.random(100) > eventDropRate)  // Drop events intermittently
        .onValue((event)=> this.emit('event', event));
    }
};