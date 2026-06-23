import { spawn } from 'node:child_process'
import type { RequestData, ResponseData, Header } from '../shared/types'
import { buildCurlArgs } from './curlBuilder'

function parseResponse(raw: string, durationMs: number): ResponseData {
  // Split on double CRLF or double LF to separate header blocks from body
  const parts = raw.split(/\r\n\r\n|\n\n/)

  // Find the index of the last HTTP header block
  let lastHeaderIdx = -1
  for (let i = 0; i < parts.length; i++) {
    if (/^HTTP\//i.test(parts[i].trimStart())) {
      lastHeaderIdx = i
    }
  }

  if (lastHeaderIdx === -1) {
    return {
      status: 0,
      statusText: 'No HTTP response',
      headers: [],
      body: raw.trim(),
      durationMs,
      sizeBytes: Buffer.byteLength(raw, 'utf8'),
      raw: raw.trim()
    }
  }

  const headerSection = parts[lastHeaderIdx]
  const body = parts
    .slice(lastHeaderIdx + 1)
    .join('\n\n')
    .trim()

  // Reconstruct the raw response from the final header block onward (dropping any
  // earlier redirect/100-continue blocks) so what we show is one clean response.
  const rawResponse = body ? `${headerSection}\r\n\r\n${body}` : headerSection

  const headerLines = headerSection.split(/\r\n|\n/)
  const statusLine = headerLines[0] || ''
  const statusMatch = statusLine.match(/HTTP\/[\d.]+ (\d+)\s*(.*)/)
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 0
  const statusText = statusMatch ? (statusMatch[2] || '').trim() : 'Unknown'

  const headers: Header[] = headerLines
    .slice(1)
    .filter((line) => line.includes(':'))
    .map((line) => {
      const colonIdx = line.indexOf(':')
      return {
        key: line.substring(0, colonIdx).trim(),
        value: line.substring(colonIdx + 1).trim(),
        enabled: true
      }
    })

  return {
    status,
    statusText,
    headers,
    body,
    durationMs,
    sizeBytes: Buffer.byteLength(body, 'utf8'),
    raw: rawResponse
  }
}

export function executeCurl(req: RequestData): Promise<ResponseData> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const args = buildCurlArgs(req)

    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn('curl', args)
    } catch {
      reject(new Error('Failed to spawn curl. Is curl installed?'))
      return
    }

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      const durationMs = Date.now() - startTime

      if (code !== 0 && !stdout) {
        reject(new Error(stderr.trim() || `curl exited with code ${code}`))
        return
      }

      try {
        resolve(parseResponse(stdout, durationMs))
      } catch (err) {
        reject(err)
      }
    })

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error('curl not found. Please install curl (sudo apt install curl).'))
      } else {
        reject(err)
      }
    })
  })
}
