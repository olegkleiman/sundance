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