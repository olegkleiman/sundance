import 'express-session'
// src/types/express.d.ts
import { Request } from 'express';

declare module 'express-session' {
    interface SessionData {
        userUtterance?: any;
        access_token?: string;
        citizenId?: string;
    }
}

type CustomJwtPayload = {
    "signInNames.citizenId"?: string;
    [key: string]: any;
};

declare module 'express-serve-static-core' {
    interface Request {
      citizenId?: string;
      headers: {
        authorization?: string;
        [key: string]: string | string[] | undefined;
      };
      access_token?: string;
    }
}

declare module 'express-serve-static-core' {
  interface Request {
    cookies: {
      [key: string]: string | undefined;
    };
  }
}