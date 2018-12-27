# Description

Logging in JavaScript that is shared with a server or preserved in other ways.
TEST STAGE. INCLUDES INCOMPLETE FEATURES INCLUDING SERVER HANDLING.

## Goals

1. To send data from client to server.
2. To preserve data in case of problem(via localStorage, etc.)

## Installation

1. Clone this repository
2. npm install
3. create ./dist directory
4. npm run build
5. Try out in example OR use bundle.js in own project

## Example

Default settings assume all files are on the same server.

* ./example/index.html

## Considerations

This library is suitable for less used, older clients due to collecting logs from all users.
Therefor, this library should be used in combination with polyfills.
Example from [polyfill.io](https://polyfill.io/v2/docs/):

```
<script src="https://cdn.polyfill.io/v2/polyfill.min.js"></script>
```

## Server

The server should be used merely for storage.
Do not want for anyone to send data to server endpoint so the following considerations should be made:

* limit single log size
* limit total stored log size
* single directory storage(avoids any bugs)
* fixed key passed when setting up server and received in code.
* session key

## License

MIT