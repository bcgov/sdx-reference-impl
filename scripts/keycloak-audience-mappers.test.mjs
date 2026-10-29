import assert from 'node:assert/strict'
import test from 'node:test'

import { findObsoleteAudienceMappers } from './keycloak-audience-mappers.mjs'

function audienceMapper(audience) {
  return {
    id: `mapper-${audience}`,
    name: `audience-${audience}`,
    protocol: 'openid-connect',
    protocolMapper: 'oidc-audience-mapper',
    config: {
      'access.token.claim': 'true',
      'id.token.claim': 'false',
      'included.custom.audience': audience,
      'userinfo.token.claim': 'false',
    },
  }
}

test('returns script-managed audience mappers that are no longer required', () => {
  const current = audienceMapper('new-provider')
  const obsolete = audienceMapper('old-provider')

  assert.deepEqual(findObsoleteAudienceMappers([current, obsolete], ['new-provider']), [obsolete])
})

test('returns all script-managed audience mappers when audiences are disabled', () => {
  const first = audienceMapper('first-provider')
  const second = audienceMapper('second-provider')

  assert.deepEqual(findObsoleteAudienceMappers([first, second], []), [first, second])
})
test('preserves unrelated and manually named protocol mappers', () => {
  const unrelated = {
    id: 'unrelated',
    name: 'email',
    protocol: 'openid-connect',
    protocolMapper: 'oidc-usermodel-property-mapper',
    config: {},
  }
  const manuallyNamed = {
    ...audienceMapper('manual-provider'),
    name: 'manually-managed-audience',
  }

  assert.deepEqual(findObsoleteAudienceMappers([unrelated, manuallyNamed], []), [])
})

test('preserves audience mappers that do not match the generated configuration', () => {
  const manuallyConfigured = audienceMapper('manual-provider')
  manuallyConfigured.config['id.token.claim'] = 'true'

  assert.deepEqual(findObsoleteAudienceMappers([manuallyConfigured], []), [])
})
