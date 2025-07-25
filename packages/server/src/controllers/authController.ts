import { Request, Response } from 'express';
import { logger } from 'genkit/logging';
import { redisClient } from '../config/redis.js';

export const login = async (req: Request, res: Response) => {
    const otp = req.body.otp;
    const phoneNumber = req.body.phoneNumber;

    const clientId = process.env.CLIENT_ID;
    if (!clientId) {
        throw new Error('CLIENT_ID is not defined in environment variables.');
    }

    const scope = process.env.LOGIN_SCOPE;
    if (!scope) {
        throw new Error('LOGIN_SCOPE is not defined in environment variables.');
    }

    const deviceId = process.env.LOGIN_DEVICE_ID;
    if (!deviceId) {
        throw new Error('LOGIN_DEVICE_ID is not defined in environment variables.');
    }

    const loginPayload = {
        phoneNumber,
        otp,
        clientId,
        scope,
        deviceId
    };

    const loginUrl = process.env.LOGIN_URL;
    if (!loginUrl) {
        throw new Error('LOGIN_URL is not defined in environment variables.');
    }

    const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginPayload)
    });

    if (!loginResponse.ok) {
        throw new Error('Failed to login');
    }

    const loginData = await loginResponse.json();
    setCookie(res, loginData.id_token);

    await redisClient.hSet(`sessions:${req.session.id}`, {
        refresh_token: loginData.refresh_token,
        access_token: loginData.access_token,
    });

    return res.json({
        access_token: loginData.access_token
    });
};

export const refresh_token = async (req: Request, res: Response) => {
    logger.debug(`/refresh_token will try to use Redis Key ${req.session.id}`);

    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
        
        await redisClient.ping();
        logger.info('Redis connection is active');

        const refreshToken = await redisClient.hGet(`sessions:${req.session.id}`, 'refresh_token');
        
        const url = process.env.REFRESH_TOKEN_URL;
        if (!url) {
            throw new Error('REFRESH_TOKEN_URL is not defined in environment variables.');
        }   

        const refreshTokenPayload = {
            clientId: process.env.CLIENT_ID,
            refresh_token: refreshToken,
            scope: process.env.REFRESH_SCOPE,
            isAnonymousLogin: false
        };

        const refreshTokenResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(refreshTokenPayload)
        });

        if (!refreshTokenResponse.ok) {
            throw new Error('Failed to refresh token');
        }

        const refreshTokenData = await refreshTokenResponse.json();
        setCookie(res, refreshTokenData.id_token);

        await redisClient.hSet(`sessions:${req.session.id}`, {
            refresh_token: refreshTokenData.refresh_token,
            access_token: refreshTokenData.id_token,
        });
        
        return res.json({
            access_token: refreshTokenData.id_token
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Error with Redis connection:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Failed to connect to Redis',
            error: errorMessage
        });
    }
};

const setCookie = (res: Response, token: string) => {
    res.cookie('access_token', token, {
        httpOnly: true,
        secure: true,      // Only sent over HTTPS
        // sameSite: 'Strict',// Prevent CSRF,
        maxAge: 0 // 1 hour
    })
}

