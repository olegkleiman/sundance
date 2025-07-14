import 'express-session'

declare module 'express-session' {
    interface SessionData {
        prompt?: any;
    }
}

type CustomJwtPayload = {
    "signInNames.citizenId"?: string;
    [key: string]: any;
};

declare module 'express-serve-static-core' {
    interface Request {
      citizenId?: string;
    }
}