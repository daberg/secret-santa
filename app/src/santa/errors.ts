import { Data } from "effect"
import { Id } from "../id/id"

export class InvalidSantaState extends Data.TaggedError("InvalidSantaState")<{
  id: string
  operation: string
  state: "drawn" | "undrawn"
}> {}

export class ParticipantNotFound extends Data.TaggedError(
  "ParticipantNotFound",
)<{
  participantName: string
}> {}

export class DuplicateParticipant extends Data.TaggedError(
  "DuplicateParticipant",
)<{
  participantName: string
}> {}

export class SantaNotFound extends Data.TaggedError("SantaNotFound")<{
  id: Id
}> {}
