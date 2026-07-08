import { UnauthorizedException } from '@nestjs/common'
import { compactVerify, createRemoteJWKSet, decodeJwt } from 'jose'

export interface JwtValidationDefaults {
  validateSignature: boolean
  validateExpiry: boolean
}

interface JwtValidationOptions {
  validateSignature: boolean
  validateExpiry: boolean
  issuer?: string
  openIdConnectUrl?: string
}

export class JwtTokenValidator {
  private jwks?: ReturnType<typeof createRemoteJWKSet>
  private discoveredJwksUrl?: string

  constructor(private readonly defaults: JwtValidationDefaults) {}

  async validate(token: string): Promise<Record<string, unknown>> {
    const claims = this.decodeJwtPayload(token)
    const options = this.validationOptions()

    if (options.validateSignature) {
      await this.validateSignature(token, options)
    }
    if (options.issuer) {
      this.validateIssuer(claims, options)
    }
    if (options.validateExpiry) {
      this.validateExpiry(claims)
    }

    return claims
  }

  private async validateSignature(token: string, options: JwtValidationOptions): Promise<void> {
    try {
      await compactVerify(token, await this.getJwks(options))
    } catch {
      throw new UnauthorizedException('JWT signature validation failed')
    }
  }

  private validateIssuer(claims: Record<string, unknown>, options: JwtValidationOptions): void {
    if (claims.iss !== options.issuer) {
      throw new UnauthorizedException('JWT issuer is invalid')
    }
  }

  private validateExpiry(claims: Record<string, unknown>): void {
    if (typeof claims.exp !== 'number') {
      throw new UnauthorizedException('JWT exp claim is required')
    }
    if (claims.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('JWT is expired')
    }
  }

  private async getJwks(
    options: JwtValidationOptions,
  ): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (this.jwks) {
      return this.jwks
    }

    const jwksUrl = await this.discoverJwksUrl(options)
    if (!jwksUrl) {
      throw new UnauthorizedException(
        'JWT signature validation is enabled but no issuer or OIDC discovery URL is configured',
      )
    }

    this.jwks = createRemoteJWKSet(new URL(jwksUrl))
    return this.jwks
  }

  private async discoverJwksUrl(options: JwtValidationOptions): Promise<string | undefined> {
    if (this.discoveredJwksUrl) {
      return this.discoveredJwksUrl
    }
    if (!options.openIdConnectUrl) {
      return undefined
    }

    const response = await fetch(options.openIdConnectUrl)
    if (!response.ok) {
      throw new UnauthorizedException('OIDC discovery failed while loading JWKS URL')
    }
    const discovery = (await response.json()) as Record<string, unknown>
    const jwksUrl = typeof discovery.jwks_uri === 'string' ? discovery.jwks_uri : undefined
    this.discoveredJwksUrl = jwksUrl
    return jwksUrl
  }

  private validationOptions(): JwtValidationOptions {
    const oidcAuthority = process.env.OIDC_AUTHORITY?.trim()
    const issuer = process.env.JWT_ISSUER?.trim()
    const openIdConnectUrl =
      process.env.OIDC_OPENID_CONNECT_URL?.trim() ||
      (oidcAuthority
        ? `${oidcAuthority.replace(/\/+$/, '')}/.well-known/openid-configuration`
        : undefined)

    return {
      validateSignature: this.readBoolean(
        'JWT_VALIDATE_SIGNATURE',
        this.defaults.validateSignature,
      ),
      validateExpiry: this.readBoolean('JWT_VALIDATE_EXPIRY', this.defaults.validateExpiry),
      issuer,
      openIdConnectUrl,
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    try {
      return decodeJwt(token)
    } catch {
      throw new UnauthorizedException('JWT payload could not be decoded')
    }
  }

  private readBoolean(name: string, defaultValue: boolean): boolean {
    const value = process.env[name]?.trim().toLowerCase()
    if (value === undefined || value === '') {
      return defaultValue
    }
    return ['true', '1', 'yes', 'y', 'on'].includes(value)
  }
}
