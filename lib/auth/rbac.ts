import { UserType } from "@/lib/types/user.types";
import { SessionData } from "./session";

/**
 * Check if the user has the required role
 */
export function hasRole(session: SessionData | null, requiredRole: UserType): boolean {
  if (!session) return false;
  return session.userType === requiredRole;
}

/**
 * Check if the user is an employer
 */
export function isEmployer(session: SessionData | null): boolean {
  return hasRole(session, UserType.EMPLOYER);
}

/**
 * Check if the user is a candidate
 */
export function isCandidate(session: SessionData | null): boolean {
  return hasRole(session, UserType.CANDIDATE);
}

/**
 * Check if the user has any of the required roles
 */
export function hasAnyRole(session: SessionData | null, roles: UserType[]): boolean {
  if (!session || !session.userType) return false;
  return roles.includes(session.userType);
}

/**
 * Require a specific role - throws error if user doesn't have the role
 * Use this in API routes or server components
 */
export function requireRole(session: SessionData | null, requiredRole: UserType): void {
  if (!hasRole(session, requiredRole)) {
    throw new Error(`Access denied. Required role: ${requiredRole}`);
  }
}

/**
 * Require any of the specified roles
 */
export function requireAnyRole(session: SessionData | null, roles: UserType[]): void {
  if (!hasAnyRole(session, roles)) {
    throw new Error(`Access denied. Required one of: ${roles.join(", ")}`);
  }
}
