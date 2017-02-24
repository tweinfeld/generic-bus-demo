const
    _ = require('lodash'),
    kefir = require('kefir');

module.exports = class {

    constructor(){
        // This is a simple connected users counter demo. It should not be used in production since it lacks memory management.
        // Real-time monitoring processes such as this would probably not aggregate data for all registered users.
        // it would rather just monitor for specific behaviours/patterns manifested in a relatively short time range/small data sample.
        let eventStream = kefir.stream(({ emit })=>{ this.send = emit; });
        eventStream
            .flatMap((function(store){
                return function(userEvent){
                    let userId = userEvent["id"];
                    return store[userId] ? kefir.never() : (function(){
                        store[userId] = true;
                        return kefir
                            .merge([kefir.later(0, userEvent), eventStream.filter(_.matches({ id: userId }))])
                            .map(({ type, create })=> type === "user_log_out" ? -1 : 1)
                            .skipDuplicates()
                            .toProperty();
                    })();
                }
            })({}))
            .scan((count, change)=> count+change ,0)
            .map((count)=>`There are ${count} connected users`)
            .log()
    }
    send(){}
};