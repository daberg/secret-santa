import * as bcrypt from "bcrypt"

const SECRET_SALT_ROUNDS = 10

export const hashSecret = (secret: string): Promise<string> =>
  bcrypt.hash(secret, SECRET_SALT_ROUNDS)

export const verifySecret = (
  secret: string,
  secretHash: string,
): Promise<boolean> => bcrypt.compare(secret, secretHash)
