/** Typed res.json() — was copy-pasted in five api-client modules. */
export async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
