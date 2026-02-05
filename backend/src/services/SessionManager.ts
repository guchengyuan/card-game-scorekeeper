import { supabase } from '../config/db';

interface Session {
  socketId: string;
  userId: string;
  roomId: string;
  createdAt: number;
}

export class SessionManager {
  private static instance: SessionManager;
  // Map<userId_roomId, socketId>
  private sessions: Map<string, string> = new Map();
  // Map<lockKey, expiryTimestamp>
  private locks: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Acquire a lock for a specific key (simulating Redis SET NX EX)
   * @param key The lock key
   * @param ttlSeconds Time to live in seconds
   * @returns true if lock acquired, false if already locked
   */
  public async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const expiry = this.locks.get(key);

    if (expiry && expiry > now) {
      return false; // Already locked
    }

    // Set new lock
    this.locks.set(key, now + ttlSeconds * 1000);
    return true;
  }

  /**
   * Release a lock
   * @param key The lock key
   */
  public async releaseLock(key: string): Promise<void> {
    this.locks.delete(key);
  }

  /**
   * Register a user session
   * @param userId User ID
   * @param roomId Room ID
   * @param socketId Socket ID
   */
  public registerSession(userId: string, roomId: string, socketId: string) {
    const key = this.getSessionKey(userId, roomId);
    this.sessions.set(key, socketId);
  }

  /**
   * Get active session socket ID
   * @param userId User ID
   * @param roomId Room ID
   */
  public getSession(userId: string, roomId: string): string | undefined {
    const key = this.getSessionKey(userId, roomId);
    return this.sessions.get(key);
  }

  /**
   * Remove a session
   * @param userId User ID
   * @param roomId Room ID
   */
  public removeSession(userId: string, roomId: string) {
    const key = this.getSessionKey(userId, roomId);
    this.sessions.delete(key);
  }

  private getSessionKey(userId: string, roomId: string): string {
    return `${userId}_${roomId}`;
  }

  /**
   * Log security event
   */
  public async logSecurityEvent(event: {
    userId: string;
    roomId: string;
    type: string;
    ip?: string;
    userAgent?: string;
    details?: any;
  }) {
    console.log(`[Security Audit] ${JSON.stringify(event)}`);
    
    try {
      await supabase.from('security_log').insert({
        user_id: event.userId,
        room_id: event.roomId,
        event_type: event.type,
        ip_address: event.ip,
        user_agent: event.userAgent,
        details: event.details,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      // Ignore if table doesn't exist, just log to console
      // console.error('Failed to write to security_log:', err);
    }
  }
}
