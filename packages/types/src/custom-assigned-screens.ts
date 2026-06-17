export type CustomAssignedScreenUser = {
  id: string;
  displayName: string;
  email: string;
  userName: string;
};

export type CustomAssignedScreen = {
  id: string;
  name: string;
  targetPageId?: string | null;
  iconPath?: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAtUtc: string;
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
