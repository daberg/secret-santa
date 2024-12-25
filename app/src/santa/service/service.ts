import { Effect, pipe } from "effect"
import { Id, makeId } from "../../id/id"
import {
  DuplicateParticipant,
  InvalidSantaState,
  ParticipantNotFound,
  SantaNotFound,
} from "../errors"
import { Santa } from "../model/santa"
import { RepoSanta, SantaRepository } from "../repository/repository"
import { Match } from "../model/match"
import { drawMatches } from "../../lib/draw"

export interface CreateSantaInput {
  name: string
  organiserName: string
}

export interface SantaService {
  readonly getSanta: (santaId: Id) => Effect.Effect<Santa, SantaNotFound>
  readonly createSanta: (createInput: CreateSantaInput) => Effect.Effect<Santa>
  readonly addParticipant: (
    santaId: Id,
    participantName: string,
  ) => Effect.Effect<
    Santa,
    SantaNotFound | InvalidSantaState | DuplicateParticipant
  >
  readonly removeParticipant: (
    santaId: Id,
    participantName: string,
  ) => Effect.Effect<
    Santa,
    SantaNotFound | InvalidSantaState | ParticipantNotFound
  >
  readonly getMatch: (
    santaId: Id,
    participantName: string,
  ) => Effect.Effect<
    Match,
    SantaNotFound | InvalidSantaState | ParticipantNotFound
  >
  readonly draw: (
    santaId: Id,
  ) => Effect.Effect<Santa, SantaNotFound | InvalidSantaState>
}

const makeRepoParticipant = (name: string) => ({
  id: makeId(),
  name,
  receiverName: null,
})

const fromRepoSanta = (repoSanta: RepoSanta): Santa => {
  const base = {
    id: repoSanta.id,
    name: repoSanta.name,
    organiserId: repoSanta.organiserId,
    participants: repoSanta.participants.map((p) => ({
      id: p.id,
      name: p.name,
    })),
  }

  return repoSanta.state === "undrawn"
    ? { ...base, __type: "UndrawnSanta" }
    : {
        ...base,
        __type: "DrawnSanta",
        matches: repoSanta.participants.map((p) => {
          if (!p.receiverName) {
            throw new Error("Unexpected missing receiver")
          }

          {
            return {
              giverName: p.name,
              receiverName: p.receiverName,
            }
          }
        }),
      }
}

export const makeSantaService = (repo: SantaRepository): SantaService => ({
  getSanta: (id) => pipe(id, repo.getSanta, Effect.map(fromRepoSanta)),
  createSanta: (createInput) => {
    const organiser = makeRepoParticipant(createInput.organiserName)

    return pipe(
      repo.createSanta({
        id: makeId(),
        name: createInput.name,
        organiserId: organiser.id,
        participants: [organiser],
        state: "undrawn",
      }),
      Effect.map(fromRepoSanta),
    )
  },
  addParticipant: (santaId, participantName) => {
    return pipe(
      santaId,
      repo.getSanta,
      Effect.andThen((santa) => {
        if (santa.state !== "undrawn") {
          return Effect.fail(
            new InvalidSantaState({
              id: santaId,
              operation: "addParticipant",
              state: santa.state,
            }),
          )
        }

        return santa.participants.find((p) => p.name === participantName)
          ? Effect.fail(new DuplicateParticipant({ participantName }))
          : repo.updateSanta(santa.id, {
              participants: [
                ...santa.participants,
                makeRepoParticipant(participantName),
              ],
            })
      }),
      Effect.map(fromRepoSanta),
    )
  },
  removeParticipant: (santaId, participantName) => {
    return pipe(
      santaId,
      repo.getSanta,
      Effect.andThen((santa) => {
        if (santa.state !== "undrawn") {
          return Effect.fail(
            new InvalidSantaState({
              id: santaId,
              operation: "removeParticipant",
              state: santa.state,
            }),
          )
        }

        const participants = santa.participants.filter(
          (p) => p.name !== participantName,
        )

        return participants.length < santa.participants.length
          ? repo.updateSanta(santaId, { participants })
          : Effect.fail(new ParticipantNotFound({ participantName }))
      }),
      Effect.map(fromRepoSanta),
    )
  },
  getMatch: (santaId, participantName) => {
    return pipe(
      santaId,
      repo.getSanta,
      Effect.andThen((santa) => {
        if (santa.state !== "drawn") {
          return Effect.fail(
            new InvalidSantaState({
              id: santaId,
              operation: "getMatch",
              state: santa.state,
            }),
          )
        }

        const participant = santa.participants.find(
          (p) => p.name === participantName,
        )
        if (!participant) {
          return Effect.fail(new ParticipantNotFound({ participantName }))
        }
        if (!participant.receiverName) {
          return Effect.die(new Error("Unexpected missing receiver"))
        }

        return Effect.succeed({
          giverName: participant.name,
          receiverName: participant.receiverName,
        })
      }),
    )
  },
  draw: (santaId) => {
    return pipe(
      santaId,
      repo.getSanta,
      Effect.andThen((santa) => {
        if (santa.state !== "undrawn") {
          return Effect.fail(
            new InvalidSantaState({
              id: santaId,
              operation: "Draw",
              state: santa.state,
            }),
          )
        }

        const matches = drawMatches(santa.participants).map((m) => ({
          giver: m[0],
          receiverName: m[1].name,
        }))

        return repo.updateSanta(santaId, {
          state: "drawn",
          participants: matches.map((m) => ({
            ...m.giver,
            receiverName: m.receiverName,
          })),
        })
      }),
      Effect.map(fromRepoSanta),
    )
  },
})
