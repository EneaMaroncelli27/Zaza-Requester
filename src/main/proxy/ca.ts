import forge from 'node-forge'

export interface CaMaterial {
  caKeyPem: string
  caCertPem: string
}

function randomSerial(): string {
  // Positive hex serial; leading 0 keeps it positive per X.509.
  return '00' + forge.util.bytesToHex(forge.random.getBytesSync(16))
}

export function createCa(): CaMaterial {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = randomSerial()
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10)

  const attrs = [{ name: 'commonName', value: 'ZazaRequester Intercept CA' }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true }
  ])
  cert.sign(keys.privateKey, forge.md.sha256.create())

  return {
    caKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    caCertPem: forge.pki.certificateToPem(cert)
  }
}

export function issueLeaf(ca: CaMaterial, host: string): { keyPem: string; certPem: string } {
  const caKey = forge.pki.privateKeyFromPem(ca.caKeyPem)
  const caCert = forge.pki.certificateFromPem(ca.caCertPem)

  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = randomSerial()
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2)

  cert.setSubject([{ name: 'commonName', value: host }])
  cert.setIssuer(caCert.subject.attributes)
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: host }] } // type 2 = DNS
  ])
  cert.sign(caKey, forge.md.sha256.create())

  return {
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certPem: forge.pki.certificateToPem(cert)
  }
}
