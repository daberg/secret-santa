export const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min

// Returns a new array containing a permutation of the original, where all
// elements are guaranteed to have changed position
export const sattoloShuffle = <T>(array: Array<T>): Array<T> => {
  const ret = [...array]

  let i = ret.length - 1
  let j

  while (i > 0) {
    j = randInt(0, i - 1)
    ;[ret[i], ret[j]] = [ret[j], ret[i]]
    i = i - 1
  }

  return ret
}
