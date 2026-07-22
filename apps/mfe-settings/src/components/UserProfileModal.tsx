"use client";

import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/design-system";
import { UserProfileContent } from "./UserProfileContent";

export function UserProfileModal({
  user,
  onClose,
}: {
  user: StaffUser;
  onClose: () => void;
}) {
  return (
    <ModalOverlay role="presentation" onClick={onClose}>
      <ModalCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
        className="max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle id="user-profile-title">البروفايل</ModalTitle>
          <ModalClose onClick={onClose} />
        </ModalHeader>

        <ModalBody className="max-h-[70vh] overflow-y-auto">
          <UserProfileContent user={user} />
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
