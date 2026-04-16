import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppService } from "./app.service";
import { verifyAndExtractSessionKey } from "./session-token";

export type UserRole = "admin" | "hr" | "manager" | "employee";
export type AuthenticatedActor = {
  sessionKey: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  position: string;
};

const PUBLIC_ROUTE_KEY = "isPublicRoute";
const ALLOWED_ROLES_KEY = "allowedRoles";
const enforceBackendAuth =
  (process.env.ENFORCE_BACKEND_AUTH ?? "").toLowerCase() === "true" ||
  (process.env.NODE_ENV ?? "").toLowerCase() === "production";

export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ALLOWED_ROLES_KEY, roles);

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly reflector: Reflector;

  constructor(private readonly appService: AppService, reflector?: Reflector) {
    this.reflector = reflector ?? new Reflector();
  }

  async canActivate(context: ExecutionContext) {
    if (!enforceBackendAuth) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (request?.method === "GET") {
      return true;
    }
    const rawCookieSession = request?.cookies?.pp_session as string | undefined;
    const headerSession = request?.headers?.["x-session-key"] as string | undefined;
    const extractedSession = verifyAndExtractSessionKey(rawCookieSession) ?? verifyAndExtractSessionKey(headerSession);
    if (!extractedSession) {
      throw new UnauthorizedException("Session is required.");
    }

    const actor = await this.appService.resolveSessionActor(extractedSession);
    if (!actor) {
      throw new UnauthorizedException("Session is invalid.");
    }

    request.user = actor;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly reflector: Reflector;

  constructor(reflector?: Reflector) {
    this.reflector = reflector ?? new Reflector();
  }

  canActivate(context: ExecutionContext) {
    if (!enforceBackendAuth) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    if (request?.method === "GET") {
      return true;
    }

    const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(ALLOWED_ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }
    const actor = request?.user as AuthenticatedActor | undefined;
    if (!actor) {
      throw new UnauthorizedException("Session is required.");
    }
    if (!allowedRoles.includes(actor.role)) {
      throw new ForbiddenException("You are not allowed to access this resource.");
    }

    return true;
  }
}
