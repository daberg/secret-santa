import { Id } from "../../id/id"

export type Participant = {
  readonly id: Id
  readonly name: string
  readonly secretHash: string
}
