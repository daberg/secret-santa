import { Id } from "../../id/id"
import { Match } from "./match"
import { Participant } from "./participant"

type BaseSanta = {
  readonly __type: string
  readonly id: Id
  readonly name: string
  readonly participants: Array<Participant>
  readonly organiserId: Id
}

export type UndrawnSanta = BaseSanta & {
  readonly __type: "UndrawnSanta"
}

export type DrawnSanta = BaseSanta & {
  readonly __type: "DrawnSanta"
  readonly matches: Array<Match>
}

export type Santa = UndrawnSanta | DrawnSanta
