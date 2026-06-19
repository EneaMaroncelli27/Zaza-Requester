// src/main/proxy/noiseHosts.test.ts
import { test, expect } from 'bun:test'
import { isNoiseRequest } from './noiseHosts'

test('matches analytics/telemetry hosts', () => {
  expect(isNoiseRequest('www.google-analytics.com', '/g/collect')).toBe(true)
  expect(isNoiseRequest('region1.google-analytics.com', '/g/collect')).toBe(true)
  expect(isNoiseRequest('www.googletagmanager.com', '/gtag/js')).toBe(true)
  expect(isNoiseRequest('stats.g.doubleclick.net', '/dc')).toBe(true)
  expect(isNoiseRequest('app-measurement.com', '/a')).toBe(true)
})

test('matches font / static CDN hosts', () => {
  expect(isNoiseRequest('fonts.googleapis.com', '/css2?family=Roboto')).toBe(true)
  expect(isNoiseRequest('fonts.gstatic.com', '/s/roboto/v30/x.woff2')).toBe(true)
  expect(isNoiseRequest('www.gstatic.com', '/og/_/js/x.js')).toBe(true)
  expect(isNoiseRequest('ajax.googleapis.com', '/ajax/libs/jquery/3/jquery.min.js')).toBe(true)
})

test('matches Google beacon paths on any host', () => {
  expect(isNoiseRequest('www.google.com', '/gen_204?x=1')).toBe(true)
  expect(isNoiseRequest('clients1.google.com', '/generate_204')).toBe(true)
})

test('does not hide real user traffic', () => {
  expect(isNoiseRequest('api.myapp.com', '/collect')).toBe(false)
  expect(isNoiseRequest('example.com', '/users/1')).toBe(false)
  expect(isNoiseRequest('notgoogle-analytics.com.evil.com', '/x')).toBe(false)
})
