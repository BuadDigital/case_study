export type CustomAssignedScreenUser = {
  id: string;
  displayName: string;
  email: string;
  userName: string;
};

import type { DynamicScreenDefinition } from "./dynamic-screen-definition";

export type CustomAssignedScreen = {
  id: string;
  name: string;
  targetPageId?: string | null;
  iconPath?: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAtUtc: string;
  code?: string | null;
  ownerRole?: string | null;
  screenStatus?: string | null;
  definition?: DynamicScreenDefinition | null;
  assignedUserIds?: string[];
  assignedUsers?: CustomAssignedScreenUser[];
};

export type SaveCustomAssignedScreenRequest = {
  name: string;
  targetPageId?: string | null;
  iconPath?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  assignedUserIds: string[];
};
