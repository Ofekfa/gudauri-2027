/** Node stand-in for the Workers runtime module (tests never instantiate Durable Objects). */
export class DurableObject<Env = unknown> {
  constructor(
    protected readonly ctx: unknown,
    protected readonly env: Env,
  ) {}
}
