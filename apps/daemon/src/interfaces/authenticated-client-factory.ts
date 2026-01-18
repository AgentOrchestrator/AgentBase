/**
 * Authenticated Client Factory Interface
 *
 * Abstracts the creation of authenticated API clients, enabling different
 * backend implementations (Supabase, Firebase, custom REST/GraphQL).
 */

/**
 * Result of creating an authenticated client
 */
export interface AuthenticatedClientResult<TClient> {
  client: TClient;
  userId: string;
}

/**
 * Factory for creating authenticated API clients.
 *
 * This is separate from IRepositoryFactory to allow:
 * 1. Direct client access when needed
 * 2. Different client types for different operations
 * 3. Client lifecycle management
 *
 * Implementations:
 * - SupabaseClientFactory - creates authenticated Supabase clients
 * - FirebaseClientFactory (future) - creates authenticated Firebase clients
 */
export interface IAuthenticatedClientFactory<TClient = unknown> {
  /**
   * Create an authenticated client using provided tokens
   * @param accessToken User's access token
   * @param refreshToken User's refresh token
   * @returns Authenticated client and user ID
   * @throws Error if authentication fails
   */
  createClient(
    accessToken: string,
    refreshToken: string
  ): Promise<AuthenticatedClientResult<TClient>>;

  /**
   * Validate that the client is still authenticated
   * @param client The client to validate
   * @returns true if client session is valid
   */
  isClientValid(client: TClient): Promise<boolean>;

  /**
   * Get the user ID from an authenticated client
   * @param client The authenticated client
   * @returns User ID or null if not authenticated
   */
  getUserIdFromClient(client: TClient): Promise<string | null>;
}
