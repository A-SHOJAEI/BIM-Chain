/**
 * Identity service for managing Fabric identities and wallet operations.
 * In production, this would use the Fabric CA client to enroll and register users.
 */

export interface UserIdentity {
  userId: string;
  orgMspId: string;
  certificate: string;
  privateKey: string;
}

export interface IIdentityService {
  /** Enroll a user with the Fabric CA and return their identity. */
  enrollUser(userId: string, secret: string, orgMspId: string): Promise<UserIdentity>;

  /** Retrieve a stored identity from the wallet. */
  getIdentity(userId: string): Promise<UserIdentity | null>;

  /** Store an identity in the wallet. */
  storeIdentity(identity: UserIdentity): Promise<void>;

  /** Remove an identity from the wallet. */
  removeIdentity(userId: string): Promise<void>;
}

/**
 * In-memory implementation for development and testing.
 */
export class MockIdentityService implements IIdentityService {
  private wallets = new Map<string, UserIdentity>();

  async enrollUser(userId: string, _secret: string, orgMspId: string): Promise<UserIdentity> {
    const identity: UserIdentity = {
      userId,
      orgMspId,
      certificate: `mock-cert-${userId}`,
      privateKey: `mock-key-${userId}`,
    };
    this.wallets.set(userId, identity);
    return identity;
  }

  async getIdentity(userId: string): Promise<UserIdentity | null> {
    return this.wallets.get(userId) ?? null;
  }

  async storeIdentity(identity: UserIdentity): Promise<void> {
    this.wallets.set(identity.userId, identity);
  }

  async removeIdentity(userId: string): Promise<void> {
    this.wallets.delete(userId);
  }
}
