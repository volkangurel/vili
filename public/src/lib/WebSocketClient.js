/* global WebSocket */

export default class WebSocketClient {
  constructor (opts) {
    const loc = window.location
    this.url = ((loc.protocol === 'https:') ? 'wss://' : 'ws://') + loc.host + opts.url
    if (opts.qs) {
      this.url += '?' + this.queryString(opts.qs)
    }
    this.messageHandler = opts.messageHandler

    // create the connection
    this.startWebSocket()
  }

  startWebSocket () {
    const self = this
    this.ws = new WebSocket(this.url)
    this.ws.onmessage = this.messageHandler
    this.ws.onclose = function () {
      if (!self.closed) {
        setTimeout(function () {
          self.startWebSocket()
        }, 5000)
      }
    }
    // ws.onerror = function (event) {
    //   console.log(event)
    // }
  }

  close () {
    this.closed = true
    this.ws.close()
  }

  // utils
  queryString (query) {
    const str = []
    for (var p in query) {
      if (query.hasOwnProperty(p)) {
        str.push(encodeURIComponent(p) + '=' + encodeURIComponent(query[p]))
      }
    }
    return str.join('&')
  }
}
