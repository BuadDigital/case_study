"use client";

import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/ui-kit";
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
        <ModalHeader className="border-0 bg-ink text-white">
          <span aria-hidden className="text-gold">
            ◈
          </span>
          <ModalTitle
            id="user-profile-title"
            className="text-start text-white"
          >
            البروفايل
          </ModalTitle>
          <ModalClose
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            ×
          </ModalClose>
        </ModalHeader>

        <ModalBody className="max-h-[70vh] overflow-y-auto">
          <UserProfileContent user={user} />
        </ModalBody>

        <ModalFooter className="justify-start">
          <Button type="button" variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
