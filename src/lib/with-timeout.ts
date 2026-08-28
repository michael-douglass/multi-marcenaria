/** Impede que uma consulta pendurada deixe a tela travada para sempre. */
export function withTimeout<T>(ms: number, message: string, work: () => Promise<T>): Promise<T> {
  let timeoutId = 0;
  const timedOut = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([work(), timedOut]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}
