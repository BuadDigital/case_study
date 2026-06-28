export type KeyFailureState = "clear" | "past" | "active";

/** Property key row for إدارة المفاتيح list. */
export type PropertyKeyRow = {
  id: string;
  idProp: string;
  deedNumber: string;
  deedStatus: string;
  po: string;
  area: string;
  type: string;
  key: boolean;
  specialist: string;
  status: string;
  court: string;
  delegate: string;
  keyFailureState: KeyFailureState;
  keyFailureLabel: string;
};
export type PropertyKeysPageData = {
  keys: PropertyKeyRow[];
  courtDelegates: string[];
};
