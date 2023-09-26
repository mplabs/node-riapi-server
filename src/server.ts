import type { Mode } from './types/custom'
import type { Readable } from 'node:stream'

import dotenv from 'dotenv'
import { Joi, Segments, celebrate, errors } from 'celebrate'
import express from 'express'
import process from 'node:process'

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp, { FitEnum } from 'sharp'
import parseInstructions from './middlewares/parse-instructions'
import { fromBase64U } from './lib/base64u'
import winston from 'winston'
import expressWinston from 'express-winston'
import cache from './middlewares/cache'

dotenv.config()

process.on('SIGINT', () => {
    console.info('Interrupted')
    process.exit(0)
})

const {
    AWS_S3_ENDPOINT = 'https://s3.amazonaws.com',
    AWS_S3_REGION = 'us-east-1',
    AWS_S3_FORCE_PATH_STYLE = 'false',
    AWS_S3_ACCESS_KEY_ID,
    AWS_S3_SECRET_ACCESS_KEY,
} = process.env

if (!AWS_S3_ACCESS_KEY_ID || !AWS_S3_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not provided')
}

const server = express()

server.use(
    expressWinston.logger({
        transports: [new winston.transports.Console()],
        format: winston.format.combine(winston.format.colorize(), winston.format.json()),
        meta: true, // optional: control whether you want to log the meta data about the request (default to true)
        msg: 'HTTP {{req.method}} {{req.url}}', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
        expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
        colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
        ignoreRoute: function (req, res) {
            return false
        }, // optional: allows to skip some log messages based on request and/or response
    })
)

// Validate input parameters
server.use(
    celebrate({
        [Segments.PARAMS]: {
            'bucket-name': Joi.string(),
        },
        [Segments.QUERY]: {
            h: Joi.number().integer().min(1),
            height: Joi.number().integer().min(1),
            w: Joi.number().integer().min(1),
            width: Joi.number().integer().min(1),
            mode: Joi.string().valid('max', 'pad', 'crop', 'stretch'),
            scale: Joi.string().valid('down', 'both', 'canvas'),
            v: Joi.number().min(0.1),
        },
    })
)

// Output validation errors
server.use(errors())

// Parse input parameters
server.use(parseInstructions())

// Caching
server.use(cache())

const mapWidthInstructionToSharp = (mode?: Mode): keyof FitEnum | undefined => {
    if (!mode) {
        return undefined
    }

    switch (mode) {
        case 'max':
            return sharp.fit.cover
        case 'pad':
            return sharp.fit.contain
        case 'crop':
            return sharp.fit.inside
        case 'stretch':
            return sharp.fit.fill
        default:
            throw new Error(`Unknown mode '${mode}'`)
    }
}

const s3client = new S3Client({
    region: AWS_S3_REGION,
    endpoint: AWS_S3_ENDPOINT,
    forcePathStyle: AWS_S3_FORCE_PATH_STYLE === 'true',
    credentials: {
        accessKeyId: AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
    },
})

server.get('/s3/*', async (req, res) => {
    const { instructions } = req
    let bucketName: string
    let key: string

    let [, first, second] = req.path.match(/s3\/([^/]+)\/(.*)/) || []

    if (!first || !second) {
        res.status(400).send({ error: 'Invalid request' })
        return
    }

    // If the bucket name is base64u encoded, decode it
    if (first === 'b64') {
        ;[, bucketName, key] = fromBase64U(second).match(/([^/]+)\/(.*)/) || []
    } else {
        bucketName = first
        key = second
    }

    const transformer = sharp().resize({
        width: instructions?.width,
        height: instructions?.height,
        fit: mapWidthInstructionToSharp(instructions?.mode),
        withoutEnlargement: ['both', 'canvas'].indexOf(instructions?.scale || 'down') !== -1,
    })

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    })

    try {
        // Retrieve the object from S3
        const s3Response = await s3client.send(command)

        // Set the content type of the response
        const contentType = s3Response.ContentType

        // Get the stream
        const stream = s3Response.Body as Readable

        stream
            .pipe(transformer)
            .toFormat('jpeg', { progressive: true, quality: instructions?.v || 80 })
            .toBuffer()
            .then((buffer) => {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': buffer.length,
                    Expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString(),
                    'Cache-Control': 'public, max-age=31536000, immutable',
                })
                res.end(buffer)
            })
    } catch (error) {
        console.error(error)
        res.status(500).send({ error })
    }
})

server.listen(3000, () => console.log('Server is running'))
