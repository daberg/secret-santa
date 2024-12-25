import { Data, Effect } from "effect"
import { v4, validate, version } from "uuid"

export type Id = string & { __brand: "id" }

export class InvalidId extends Data.TaggedError("InvalidUuid")<{}> {}

export const parseId = (uuid: string): Effect.Effect<Id, InvalidId> => {
  if (!validate(uuid) || version(uuid) !== 4) {
    return Effect.fail(new InvalidId())
  }

  return Effect.succeed(uuid as Id)
}

export const makeId = () => v4() as Id
