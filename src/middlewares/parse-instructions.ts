import { Mode, Scale } from '@/types/custom'
import { NextFunction, Request, Response } from 'express'

const parseInstructions =
    () =>
    (req: Request, res: Response, next: NextFunction): void => {
        const query = req.query

        if (query.height || query.h) {
            // Order of operations is important here, 'height' has precedence over 'h'
            const height = Math.abs(
                parseInt((query.height as unknown as string) || (query.h as unknown as string))
            )
            if (height) {
                req.instructions = { ...req.instructions, height }
            }
        }

        if (query.width || query.w) {
            // Order of operations is important here, 'with' has precedence over 'w'
            const width = Math.abs(
                parseInt((query.width as unknown as string) || (query.w as unknown as string))
            )
            if (width) {
                req.instructions = { ...req.instructions, width }
            }
        }

        if (query.mode) {
            const mode = query.mode as Mode
            if (mode) {
                req.instructions = { ...req.instructions, mode }
            }
        }

        if (query.scale) {
            const scale = query.scale as Scale
            if (scale) {
                req.instructions = { ...req.instructions, scale }
            }
        }

        if (query.v) {
            const v = Math.abs(parseInt(query.v as unknown as string))
            if (v) {
                req.instructions = { ...req.instructions, v }
            }
        }

        next()
    }

export default parseInstructions
