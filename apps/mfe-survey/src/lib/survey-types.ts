/** Survey office row from `/api/survey-offices`. */
export type SurveyOfficeListRow = {
  id: string;
  name: string;
  active: number;
  doneMonth: number;
  avgDays: string;
  contract: string;
  statusBusy: boolean;
};
