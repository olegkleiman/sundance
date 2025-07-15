import 'express-session'

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
      access_token?: string;
    }
}