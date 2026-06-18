// src/main/proxy/server.ts
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import { randomUUID } from 'node:crypto'
import type { CaMaterial } from './ca'
import { issueLeaf } from './ca'
import type { InterceptEngine } from './interceptEngine'
import type { InterceptedRequest } from './requestModel'

export interface ProxyOptions {
  ca: CaMaterial
  engine: InterceptEngine
  timeoutMs: number
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
  })
}

function headerPairs(req: http.IncomingMessage): [string, string][] {
  const out: [string, string][] = []
  const raw = req.rawHeaders
  for (let i = 0; i < raw.length; i += 2) out.push([raw[i], raw[i + 1]])
  return out
}

export class MitmProxy {
  readonly engine: InterceptEngine
  private ca: CaMaterial
  private timeoutMs: number
  private server: http.Server
  private tlsServers = new Map<string, tls.Server>()

  constructor(opts: ProxyOptions) {
    this.ca = opts.ca
    this.engine = opts.engine
    this.timeoutMs = opts.timeoutMs
    this.server = http.createServer((req, res) => this.onHttp(req, res, 'http'))
    this.server.on('connect', (req, socket) => this.onConnect(req, socket))
  }

  start(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        resolve((this.server.address() as net.AddressInfo).port)
      })
    })
  }

  async stop(): Promise<void> {
    for (const s of this.tlsServers.values()) s.close()
    this.tlsServers.clear()
    await new Promise<void>((r) => this.server.close(() => r()))
  }

  private async onHttp(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    protocol: 'http' | 'https',
    hostOverride?: string
  ): Promise<void> {
    const body = await readBody(req)
    // Plain HTTP arrives in absolute form (http://host/path); HTTPS (post-CONNECT)
    // arrives in origin form (/path) so host comes from the CONNECT target.
    let host: string
    let port: number
    let path: string
    let urlStr: string
    if (protocol === 'http' && req.url?.startsWith('http')) {
      const u = new URL(req.url)
      host = u.hostname
      port = u.port ? Number(u.port) : 80
      path = u.pathname + u.search
      urlStr = req.url
    } else {
      const [h, p] = (hostOverride ?? req.headers.host ?? '').split(':')
      host = h
      port = p ? Number(p) : protocol === 'https' ? 443 : 80
      path = req.url ?? '/'
      urlStr = `${protocol}://${host}${port === (protocol === 'https' ? 443 : 80) ? '' : ':' + port}${path}`
    }

    const intercepted: InterceptedRequest = {
      id: randomUUID(),
      method: req.method ?? 'GET',
      url: urlStr,
      host,
      port,
      protocol,
      path,
      headers: headerPairs(req),
      body
    }

    const resolution = await this.engine.handle(intercepted, this.timeoutMs)
    if (resolution.action === 'drop') {
      res.socket?.destroy()
      return
    }
    const final = resolution.edited ?? intercepted
    this.forward(final, res)
  }

  private forward(reqData: InterceptedRequest, res: http.ServerResponse): void {
    const transport = reqData.protocol === 'https' ? https : http
    const headers: Record<string, string> = {}
    const hasBody = reqData.body.length > 0
    for (const [k, v] of reqData.headers) {
      if (hasBody && k.toLowerCase() === 'content-length') continue
      headers[k] = v
    }
    if (hasBody) headers['Content-Length'] = String(Buffer.byteLength(reqData.body, 'utf8'))

    const upstream = transport.request(
      { host: reqData.host, port: reqData.port, method: reqData.method, path: reqData.path, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      }
    )
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502)
      res.end('Proxy upstream error')
    })
    if (hasBody) upstream.write(reqData.body)
    upstream.end()
  }

  private onConnect(req: http.IncomingMessage, clientSocket: net.Socket): void {
    const [host, portStr] = (req.url ?? '').split(':')
    const port = portStr ? Number(portStr) : 443
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

    let tlsServer = this.tlsServers.get(host)
    if (!tlsServer) {
      const leaf = issueLeaf(this.ca, host)
      tlsServer = tls.createServer({ key: leaf.keyPem, cert: leaf.certPem })
      tlsServer.on('secureConnection', (tlsSocket) => {
        const decrypted = http.createServer()
        decrypted.on('request', (r, s) => this.onHttp(r, s, 'https', `${host}:${port}`))
        decrypted.emit('connection', tlsSocket)
      })
      this.tlsServers.set(host, tlsServer)
    }
    tlsServer.emit('connection', clientSocket)
  }
}
