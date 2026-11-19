/** Why an API call failed — the `kind` of every `ApiErr`. No imports: every module may use it. */
export const ApiErrorKinds = {
  Auth: "auth",
  Forbidden: "forbidden",
  Network: "network",
  Validation: "validation",
  Server: "server",
  NotFound: "not_found",
} as const;
export type ApiErrorKind = (typeof ApiErrorKinds)[keyof typeof ApiErrorKinds];
