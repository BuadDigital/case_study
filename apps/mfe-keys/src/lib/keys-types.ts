/** Property key row for إدارة المفاتيح list. */
export type PropertyKeyRow = {
  id: string;
  idProp: string;
  po: string;
  area: string;
  type: string;
  key: boolean;
  specialist: string;
  status: string;
  court: string;
  delegate: string;
};

export type PropertyKeysPageData = {
  keys: PropertyKeyRow[];
  courtDelegates: string[];
};
