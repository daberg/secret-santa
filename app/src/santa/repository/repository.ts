import { Effect } from "effect"
import { Id } from "../../id/id"
import { SantaNotFound } from "../errors"

export type RepoSantaState = "drawn" | "undrawn"

export type RepoParticipant = {
  id: Id
  name: string
  receiverName: string | null
}

export type RepoSanta = {
  id: Id
  name: string
  organiserId: Id
  participants: Array<RepoParticipant>
  state: RepoSantaState
}

export interface CreateSantaInput extends RepoSanta {}

export interface UpdateSantaInput {
  name?: string
  participants?: Array<RepoParticipant>
  state?: RepoSantaState
}

export interface SantaRepository {
  readonly getSanta: (santaId: Id) => Effect.Effect<RepoSanta, SantaNotFound>
  readonly createSanta: (santa: CreateSantaInput) => Effect.Effect<RepoSanta>
  readonly updateSanta: (
    santaId: Id,
    santa: UpdateSantaInput,
  ) => Effect.Effect<RepoSanta, SantaNotFound>
}
