// src/main/proxy/ca.test.ts
import { test, expect } from 'bun:test'
import forge from 'node-forge'
import { createCa, issueLeaf } from './ca'

test('createCa produces a self-signed CA cert', () => {
  const ca = createCa()
  const cert = forge.pki.certificateFromPem(ca.caCertPem)
  expect(cert.subject.getField('CN')?.value).toBe('ZazaRequester Intercept CA')
  // self-signed: issuer === subject
  expect(cert.isIssuer(cert)).toBe(true)
})

test('issueLeaf signs a host cert that chains to the CA', () => {
  const ca = createCa()
  const leaf = issueLeaf(ca, 'example.com')
  const caCert = forge.pki.certificateFromPem(ca.caCertPem)
  const leafCert = forge.pki.certificateFromPem(leaf.certPem)
  // CA verifies the leaf's signature
  expect(caCert.verify(leafCert)).toBe(true)
  expect(leafCert.subject.getField('CN')?.value).toBe('example.com')
  const san = leafCert.getExtension('subjectAltName') as { altNames: { value: string }[] }
  expect(san.altNames.some((n) => n.value === 'example.com')).toBe(true)
})
