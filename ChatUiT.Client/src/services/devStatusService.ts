import apiService from './apiService';

export interface ClaimDto {
  type: string;
  value: string;
}

export interface DevStatusDto {
  environment: string;
  userId: string;
  /** Roles as the server resolved them from the claims. */
  roles: string[];
  /** Group ids as the server resolved them from the claims. */
  groupIds: string[];
  /** The token carries an overage marker instead of the group list; the server treats that as no groups. */
  groupsOverage: boolean;
  /** Every claim on the validated token, in order. */
  claims: ClaimDto[];
}

/** Development only: the server answers 404 elsewhere. */
export async function getDevStatus(): Promise<DevStatusDto> {
  return apiService<DevStatusDto>('/api/dev/status');
}
