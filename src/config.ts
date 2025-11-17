process.loadEnvFile();

export type APIConfig = {
  fileserverHits: number;
  dbURL: string;
};

//helper to ensure secrets exist
const envOrThrow = (key: string): string => {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return val;
};

//this object will hold our state
export const apiConfig: APIConfig = {
  fileserverHits: 0,
  dbURL: envOrThrow("DB_URL"),
};
