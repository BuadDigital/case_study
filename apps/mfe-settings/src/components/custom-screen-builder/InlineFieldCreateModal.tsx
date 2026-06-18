"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Label,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
} from "@platform/design-system";
import {
  DYNAMIC_SCREEN_FIELD_TYPE_GROUPS,
  DYNAMIC_SCREEN_FIELD_TYPE_LABELS,
  LIST_LIKE_FIELD_TYPES,
  newDynamicFieldId,
  nextDynamicFieldRef,
} from "@platform/app-shared/dynamic-screens";
import type {
  DynamicScreenDefinition,
  DynamicScreenField,
  DynamicScreenFieldType,
} from "@platform/types";

type Props = {
  definition: DynamicScreenDefinition;
  onSave: (definition: DynamicScreenDefinition) => void;
  onClose: () => void;
};

export function InlineFieldCreateModal({ definition, onSave, onClose }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DynamicScreenFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [placeholder, setPlaceholder] = useState("");

  function handleSave(): void {
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert("اكتب اسم الحقل.");
      return;
    }

    const options = LIST_LIKE_FIELD_TYPES.includes(type)
      ? optionsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : undefined;

    if (LIST_LIKE_FIELD_TYPES.includes(type) && (!options || options.length === 0)) {
      window.alert("أضف خياراً واحداً على الأقل (سطر لكل خيار).");
      return;
    }

    const field: DynamicScreenField = {
      id: newDynamicFieldId(),
      ref: nextDynamicFieldRef(definition.fields),
      name: trimmed,
      type,
      options,
      placeholder: placeholder.trim() || undefined,
    };

    onSave({
      ...definition,
      fields: [...definition.fields, field],
    });
    onClose();
  }

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        className="max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle>حقل جديد</ModalTitle>
        </ModalHeader>
        <div className="space-y-3 px-5 py-4">
          <div>
            <Label htmlFor="new-field-name">اسم الحقل</Label>
            <Input
              id="new-field-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: تاريخ الزيارة"
            />
          </div>
          <div>
            <Label htmlFor="new-field-type">النوع</Label>
            <Select
              id="new-field-type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as DynamicScreenFieldType)
              }
            >
              {DYNAMIC_SCREEN_FIELD_TYPE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.types.map((fieldType) => (
                    <option key={fieldType} value={fieldType}>
                      {DYNAMIC_SCREEN_FIELD_TYPE_LABELS[fieldType]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          {LIST_LIKE_FIELD_TYPES.includes(type) ? (
            <div>
              <Label htmlFor="new-field-options">الخيارات (سطر لكل خيار)</Label>
              <textarea
                id="new-field-options"
                className="min-h-[88px] w-full rounded border border-border bg-surface px-3 py-2 text-sm"
                value={optionsText}
                onChange={(event) => setOptionsText(event.target.value)}
                placeholder={"خيار ١\nخيار ٢"}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="new-field-placeholder">نص توضيحي (اختياري)</Label>
            <Input
              id="new-field-placeholder"
              value={placeholder}
              onChange={(event) => setPlaceholder(event.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" variant="primary" onClick={handleSave}>
            إضافة للقاموس
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
