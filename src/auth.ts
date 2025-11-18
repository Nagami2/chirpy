import argon2 from "argon2";
import jwt from "jsonwebtoken";

export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password);
};

export const checkPasswordHash = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await argon2.verify(hash, password);
};

export const makeJWT = (
  userID: string,
  expiresIn: number,
  secret: string,
): string => {
  // create the token options
  // iat: issued At (current time in seconds)
  // exp: Expiration (current time + duration)
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresIn;

  // sign the payload with your secret
  // we explicitly define the payload structure
  return jwt.sign(
    {
      iss: "chirpy", //issuer
      sub: userID, // Subject
      iat,
      exp,
    },
    secret,
    { algorithm: "HS256" },
  );
};

export const validateJWT = (tokenString: string, secret: string): string => {
  // verify the token
  // THROW an error is the signature is wrong or if it's expired
  const decoded = jwt.verify(tokenString, secret) as jwt.JwtPayload;

  // return the User ID(subject)
  // we assume sub exists becuase we put it there in makeJWT
  if (!decoded.sub) {
    throw new Error("Invalid token payload: missing sub");
  }
  return decoded.sub;
};
