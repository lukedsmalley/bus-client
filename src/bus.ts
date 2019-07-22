import { AuthorizedSocket } from './authorized-socket'

export class Bus {
  private constructor(private socket: AuthorizedSocket) { }

  static async connect(url: string, id: string, secret: string) {
    return new Bus(await AuthorizedSocket.connect(url, id, secret))
  }
}
