import { Effect, pipe } from "effect"
import { Id, makeId } from "../../id/id"
import {
  DuplicateParticipant,
  InvalidSantaState,
  ParticipantNotFound,
  SantaNotFound,
} from "../errors"
import { Santa } from "../model/santa"
import {
  RepoParticipant,
  RepoSanta,
  SantaRepository,
} from "../repository/repository"
import { Match } from "../model/match"
import { drawMatches } from "../../lib/draw"
import { hashSecret } from "../../lib/crypto"

export interface CreateSantaInput {
  name: string
  organiser: {
    name: string
  }
}

export interface ParticipantInput {
  name: string
}

export interface SantaService {
  readonly getSanta: (santaId: Id) => Effect.Effect<Santa, SantaNotFound>
  readonly createSanta: (
    createInput: CreateSantaInput,
  ) => Effect.Effect<{ santa: Santa; organiserSecret: string }>
  readonly addParticipant: (
    santaId: Id,
    participantInput: ParticipantInput,
  ) => Effect.Effect<
    { santa: Santa; participantSecret: string },
    SantaNotFound | InvalidSantaState | DuplicateParticipant
  >
  readonly removeParticipant: (
    santaId: Id,
    participantName: string,
  ) => Effect.Effect<
    { santa: Santa },
    SantaNotFound | InvalidSantaState | ParticipantNotFound
  >
  readonly draw: (
    santaId: Id,
  ) => Effect.Effect<{ santa: Santa }, SantaNotFound | InvalidSantaState>
  readonly getMatch: (
    santaId: Id,
    participantName: string,
  ) => Effect.Effect<
    Match,
    SantaNotFound | InvalidSantaState | ParticipantNotFound
  >
}

const makeRepoParticipant = (participantData: {
  name: string
  secret: string
}): Effect.Effect<RepoParticipant> =>
  Effect.promise(() => hashSecret(participantData.secret)).pipe(
    Effect.map((secretHash) => ({
      id: makeId(),
      name: participantData.name,
      secretHash,
      receiverName: null,
    })),
  )

const fromRepoSanta = (repoSanta: RepoSanta): Santa => {
  const base = {
    id: repoSanta.id,
    name: repoSanta.name,
    organiserId: repoSanta.organiserId,
    participants: repoSanta.participants.map((p) => ({
      id: p.id,
      name: p.name,
      secretHash: p.secretHash,
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
  createSanta: (createInput) =>
    Effect.gen(function* () {
      const secret = makeId()

      const organiser = yield* makeRepoParticipant({
        ...createInput.organiser,
        secret,
      })

      const createdSanta = yield* repo
        .createSanta({
          id: makeId(),
          name: createInput.name,
          organiserId: organiser.id,
          participants: [organiser],
          state: "undrawn",
        })
        .pipe(Effect.map(fromRepoSanta))

      return {
        santa: createdSanta,
        organiserSecret: secret,
      }
    }),
  addParticipant: (santaId, participantInput) =>
    Effect.gen(function* () {
      const santa = yield* repo.getSanta(santaId)

      if (santa.state !== "undrawn") {
        return yield* Effect.fail(
          new InvalidSantaState({
            id: santaId,
            operation: "addParticipant",
            state: santa.state,
          }),
        )
      }

      if (santa.participants.find((p) => p.name === participantInput.name)) {
        return yield* Effect.fail(
          new DuplicateParticipant({ participantName: participantInput.name }),
        )
      }

      const secret = makeId()

      const newParticipant = yield* makeRepoParticipant({
        name: participantInput.name,
        secret,
      })

      const updatedSanta = yield* repo
        .updateSanta(santa.id, {
          participants: [...santa.participants, newParticipant],
        })
        .pipe(Effect.map(fromRepoSanta))

      return {
        santa: updatedSanta,
        participantSecret: secret,
      }
    }),
  removeParticipant: (santaId, participantName) =>
    pipe(
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
          ? repo.updateSanta(santaId, { participants }).pipe(
              Effect.map(fromRepoSanta),
              Effect.map((santa) => ({ santa })),
            )
          : Effect.fail(new ParticipantNotFound({ participantName }))
      }),
    ),
  getMatch: (santaId, participantName) =>
    pipe(
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
    ),
  draw: (santaId) =>
    pipe(
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
      Effect.map((santa) => ({ santa })),
    ),
})
