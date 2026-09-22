import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('railway.json', () => {
  it('builds from the Dockerfile with a health check on the status route and one replica', () => {
    const cfg = JSON.parse(readFileSync('railway.json', 'utf8'))
    expect(cfg.build.builder).toBe('DOCKERFILE')
    expect(cfg.build.dockerfilePath).toBe('Dockerfile')
    expect(cfg.deploy.healthcheckPath).toBe('/api/_status')
    expect(cfg.deploy.numReplicas).toBe(1)
    expect(cfg.deploy.restartPolicyType).toBe('ON_FAILURE')
  })
})
