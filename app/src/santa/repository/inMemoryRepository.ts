import { Effect, HashMap, Option, pipe } from "effect"
import { Id } from "../../id/id"
import { SantaNotFound } from "../errors"
import { RepoSanta, SantaRepository } from "./repository"

export const makeInMemoryRepository = (): SantaRepository => {
  const idToSanta = HashMap.empty<Id, RepoSanta>()

  const getSanta = (id: Id): Effect.Effect<RepoSanta, SantaNotFound> =>
    idToSanta.pipe(
      HashMap.get(id),
      Option.match({
        onNone: () => Effect.fail(new SantaNotFound({ id })),
        onSome: (s) => Effect.succeed(s),
      }),
    )

  const saveSanta = (santa: RepoSanta): Effect.Effect<RepoSanta> =>
    idToSanta.pipe(
      HashMap.set(santa.id, santa),
      HashMap.unsafeGet(santa.id),
      Effect.succeed,
    )

  return {
    getSanta,
    createSanta: saveSanta,
    updateSanta: (santaId, update) => {
      return pipe(
        santaId,
        getSanta,
        Effect.flatMap((santa) => {
          const updatedSanta: RepoSanta = {
            id: santa.id,
            name: update.name ?? santa.name,
            organiserId: santa.organiserId,
            participants: update.participants ?? santa.participants,
            state: update.state ?? santa.state,
          }
          return saveSanta(updatedSanta)
        }),
      )
    },
  }
}
