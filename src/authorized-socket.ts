import WebSocket, { ClientOptions } from 'ws'
import { promisify } from 'util';

const RECONNECT_DELAY = 1002

export class AuthorizedSocket {
  private reconnectTimeout: NodeJS.Timeout | null = null
  private socket: WebSocket | null = null

  private constructor(private url: string,
                      private id: string,
                      private secret: string) { }

  private scheduleReconnect() {
    this.reconnectTimeout = setTimeout(() => {
      this.connect()
        .catch(() => {
          if (this.socket) {
            this.scheduleReconnect()
          }
        })
    }, RECONNECT_DELAY)
  }

  private connect(): Promise<this> {
    const socket = new WebSocket(this.url, { auth: `${this.id}:${this.secret}` } as ClientOptions)
    return new Promise((resolve, reject) => {
      let error: Error | null = null
      socket.on('error', err => error = err)
      socket.once('close', code => reject(`Could not connect (closed with code ${code}) due to ${error}`))
      socket.once('open', () => {
        socket.removeAllListeners('error')
        socket.removeAllListeners('close')
        socket.once('close', this.scheduleReconnect.bind(this))
        this.socket = socket
        resolve(this)
      })
    })
  }

  static async connect(url: string, id: string, secret: string) {
    return await new AuthorizedSocket(url, id, secret).connect()
  }

  close() {
    const socket = this.socket
    this.socket = null
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (socket) {
      return new Promise(resolve => {
        socket.removeAllListeners('close')
        socket.once('close', resolve)
        socket.close()
      })
    } else {
      return Promise.resolve()
    }
  }

  send(message: any) {
    const socket = this.socket
    if (socket) {
      return new Promise((resolve, reject) => {
        socket.send(message, err => {
          if (err) {
            resolve(this.close()
              .then(this.connect.bind(this))
              .catch(err => reject(err))
              .then(() => promisify(this.socket!.send.bind(this.socket))(message)))
          } else {
            resolve()
          }
        })
      })
    } else {
      return Promise.reject('Socket is disconnected')
    }
  }
}
