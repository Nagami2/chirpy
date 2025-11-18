import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Request } from "express";
import crypto from "crypto";

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

export const getBearerToken = (req: Request): string => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new Error("No authorization header");
  }

  // the header looks like: "Bearer eyhj...."
  const splitAuth = authHeader.split(" ");
  if (splitAuth.length !== 2 || splitAuth[0] !== "Bearer") {
    throw new Error("Malformed authroization header");
  }
  return splitAuth[1];
};

export const makeRefreshToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const getAPIKey = (req: Request): string => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new Error("No authorization header");
  }

  // Expected format: "ApiKey f271c..."
  const splitAuth = authHeader.split(" ");

  if (splitAuth.length !== 2 || splitAuth[0] !== "ApiKey") {
    throw new Error("Malformed authorization header");
  }

  return splitAuth[1];
};
