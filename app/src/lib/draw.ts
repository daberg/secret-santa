import { zip } from "effect/Array"
import { sattoloShuffle } from "./random"

export const drawMatches = <T>(array: Array<T>): Array<[T, T]> => {
  return zip(array, sattoloShuffle(array))
}
