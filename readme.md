### Intro

This is a sample project demonstrating a method to collect events from different sources, and process them in a centric fashion.

_This example employs a "Function Reactive Programming" library named "[Kefir](https://rpominov.github.io/kefir/)". Notice that Kefir (or any other alternative FRP lib) reflects an implementation choice rather than a substaincial architecture decision. All units' interfaces are library-agnostic._

This project supports two different source types:

#### Webhooks 
Used to collect messages from a HTTP endpoint. It can be used in conjuction with services which support Webhooks, such as segment.com and others. It provides some basic features:
* Route configuration
* Request size limitation
* HMAC (sha1-based) message verification

#### Random User
Generates login/logout events for random users to simulate sessions.

### Code Architecture Guidelines

Here's a short list of guidelines used when authoring this code. It serves as a list of general architecture recommendations.

* Keep your unit interface generic and familiar. Prefer using plain primitives or Node/JS types such as Buffer, POJOs, Streams, Promises and EventEmitters on your interface. Don't consume/return custom class instances (i.e. lodash/frp wrapper). If the unit is dependant on a "live" instance, pass it once through your class constructor (or curried function). Passing along references to Mongoose instances _might_ look as a benign data contract, yet it is advisable to avoid it too, since it offers an elaborate interface which might do things outside a contract's responsibility, such as persisting data to the DB etc. It also introduces unwanted coupling with Mongo and the Mongoose library.
* Make your unit only handle one specific responsibility. For instance, If your code unit is aimed at performing user authentication, avoid doing additional stuff like storing audit logs in it. Instead, you can share the extra information (e.g. through events), leaving your consumer to decide how to handle auditing.
* Avoid depending on buses in your interface - especially when intending to write to them. Buses might be unintentionally used to couple several unrelated code-units as well as impair the unit's explicit interface (a consumer should be familiar with all the different data structures flowing through the bus).
* Avoid using the module system for "soldering" code units. Don't instantiate classes or perform any runtime logic unrelated to the module definition.