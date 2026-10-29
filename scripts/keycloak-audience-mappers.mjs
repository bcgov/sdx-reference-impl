export function findObsoleteAudienceMappers(mappers, requiredAudiences) {
  const required = new Set(requiredAudiences)

  return mappers.filter((mapper) => {
    const audience = mapper.config?.['included.custom.audience']

    return (
      typeof mapper.id === 'string' &&
      typeof audience === 'string' &&
      mapper.name === `audience-${audience}` &&
      mapper.protocol === 'openid-connect' &&
      mapper.protocolMapper === 'oidc-audience-mapper' &&
      mapper.config?.['access.token.claim'] === 'true' &&
      mapper.config?.['id.token.claim'] === 'false' &&
      mapper.config?.['userinfo.token.claim'] === 'false' &&
      !required.has(audience)
    )
  })
}
